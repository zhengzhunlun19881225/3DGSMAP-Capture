import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline import settings, sfm_key, brush_step, run_process, feature_count, brush_command
import reconstruction_server as api


class PipelineTests(unittest.TestCase):
    def test_cache_changes_with_images_or_sfm_not_training(self):
        with tempfile.TemporaryDirectory() as tmp:
            images = Path(tmp); (images / 'a.jpg').write_bytes(b'first image')
            config = settings({})
            key = sfm_key(images, config)
            self.assertEqual(key, sfm_key(images, dict(config, steps=9999)))
            self.assertNotEqual(key, sfm_key(images, dict(config, sfmMaxSize=2200)))
            (images / 'a.jpg').write_bytes(b'changed image')
            self.assertNotEqual(key, sfm_key(images, config))

    def test_real_brush_format_and_wrong_denominator(self):
        self.assertEqual(brush_step('\x1b[2K[00:14] ◍○○   125/   3000 Steps (9/s, 5m remaining)', 3000), 125)
        self.assertIsNone(brush_step('125/30000 Steps', 3000))
        self.assertIsNone(brush_step('Loading dataset with 13 views', 3000))

    def test_pty_reads_live_carriage_return_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            lines = []
            code = "import sys; assert sys.stdout.isatty(); print('\\x1b[2K 5/10 Steps',end='\\r',flush=True); print('10/10 Steps',flush=True)"
            run_process([sys.executable, '-c', code], Path(tmp)/'log', lines.append, terminal=True)
            self.assertIn(5, [brush_step(line, 10) for line in lines])
            self.assertIn(10, [brush_step(line, 10) for line in lines])

    def test_process_failure_surfaces_without_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(RuntimeError, '退出码 3'):
                run_process([sys.executable, '-c', 'raise SystemExit(3)'], Path(tmp)/'log', lambda _: None)

    def test_feature_progress_reads_wal(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp)/'database.db'
            with sqlite3.connect(db) as con:
                con.execute('PRAGMA journal_mode=WAL')
                con.execute('CREATE TABLE descriptors (image_id INTEGER, rows INTEGER)')
                con.execute('INSERT INTO descriptors VALUES (1, 100)')
                con.execute('INSERT INTO descriptors VALUES (2, 0)')
                con.commit()
                self.assertEqual(feature_count(db), 1)

    def test_final_export_required_and_cached_sfm_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); jobs=root/'jobs'; cache=root/'cache'; job=jobs/'abcdef123456'
            (job/'images').mkdir(parents=True); (job/'output').mkdir()
            for name in ('a.jpg','b.jpg'): (job/'images'/name).write_bytes(b'photo')
            config=settings({'steps':10}); (job/'config.json').write_text(json.dumps(config))
            solved=cache/sfm_key(job/'images',config); (solved/'sparse'/'0').mkdir(parents=True)
            (solved/'sparse'/'0'/'cameras.bin').write_bytes(b'test')
            (solved/'result.json').write_text(json.dumps(dict(registered_images=2,sparse_points=3)))
            state={'abcdef123456':dict(logs=[],status='queued',progress=0,phase='queued')}
            with patch.object(api,'RUNTIME',jobs), patch.object(api,'CACHE',cache), patch.object(api,'_jobs',state), patch.object(api,'_brush_binary',return_value=Path('/brush')), patch.object(api,'run_process') as process:
                # A successful subprocess without final export is not a completed job.
                with self.assertRaisesRegex(RuntimeError, '最终步数'):
                    api._compute('abcdef123456',config,job,job/'images',job/'output')
                self.assertEqual(process.call_count,1)  # cache skipped the SfM subprocess
                self.assertNotEqual(state['abcdef123456']['status'],'completed')
                (job/'output'/'export_10.ply').write_bytes(b'ply\n')
                api._compute('abcdef123456',config,job,job/'images',job/'output')
                self.assertEqual(state['abcdef123456']['status'],'completed')
                self.assertTrue((job/'status.json').exists())

    def test_presets_and_validation(self):
        cfg=settings({})
        self.assertEqual(cfg['steps'],3000)
        self.assertEqual(settings({'profile':'quality'})['steps'],30000)
        command=brush_command('/brush','/dataset','/output',cfg)
        self.assertEqual(command[command.index('--export-every')+1],'1000')
        with self.assertRaises(ValueError): settings({'maxResolution':0})
        with self.assertRaises(ValueError): settings({'profile':'typo'})

    def test_short_profiles_allow_enough_densification_cycles(self):
        # Shortening training must not reduce densification to only seven rounds.
        for profile in ('preview', 'balanced', 'quality'):
            config = settings({'profile': profile})
            command = brush_command('/brush', '/dataset', '/output', config)
            stop = int(command[command.index('--growth-stop-iter') + 1])
            every = int(command[command.index('--refine-every') + 1])
            self.assertGreaterEqual(stop // every, 40)
            self.assertGreater(config['steps'] - stop, 0)


if __name__ == '__main__': unittest.main()
