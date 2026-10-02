"""Manual real-data smoke test. Isolated temp output, ephemeral localhost port.
Usage: python server/tests/smoke_api.py /absolute/path/to/images
Only 10 training steps at 320px; does not certify reconstruction quality.
"""
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import reconstruction_server as api


def main(images):
    root = Path(tempfile.mkdtemp(prefix='3dgs-api-smoke-'))
    api.RUNTIME = root/'jobs'; api.RUNTIME.mkdir()
    api.CACHE = root/'cache'; api.CACHE.mkdir()
    server=api.ThreadingHTTPServer(('127.0.0.1',0),api.Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
    base=f'http://127.0.0.1:{server.server_port}'
    boundary='3dgs-smoke-boundary'
    parts=[f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'.encode(),
           json.dumps(dict(profile='preview',steps=10,maxResolution=320,maxGaussianPoints=10000)).encode(), b'\r\n']
    for file in sorted(Path(images).glob('*.jpg')):
        parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="images"; filename="{file.name}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode(), file.read_bytes(), b'\r\n'])
    parts.append(f'--{boundary}--\r\n'.encode())
    body=b''.join(parts)
    print('Output:',root,flush=True)
    try:
        ids=[]
        for _ in range(2):
            req=Request(base+'/api/reconstruct',body,{'Content-Type':f'multipart/form-data; boundary={boundary}'})
            with urlopen(req,timeout=20) as response:
                ids.append(json.load(response)['job_id'])
        deadline=time.monotonic()+180
        finished=set(); observed_queue=False
        while len(finished)<2 and time.monotonic()<deadline:
            states=[]
            for job_id in ids:
                with urlopen(base+'/api/jobs/'+job_id,timeout=10) as response: state=json.load(response)
                states.append(state)
                observed_queue |= state['status']=='queued'
                if state['status']=='failed': raise RuntimeError(state)
                if state['status']=='completed' and job_id not in finished:
                    finished.add(job_id)
                    print(json.dumps({k:state.get(k) for k in ('id','status','registered_images','training_step','cache_hit','artifact')},ensure_ascii=False),flush=True)
                    with urlopen(base+f'/api/jobs/{job_id}/artifact/'+state['artifact']) as response:
                        assert response.headers['Access-Control-Allow-Origin']=='*'
                        assert response.read(3)==b'ply'
            assert sum(s['status']=='processing' for s in states)<=1, 'Concurrent compute jobs!'
            if len(finished)<2: time.sleep(1)
        assert len(finished)==2, 'Timed out'
        assert observed_queue, 'Queue was not observed'
        assert states[1].get('cache_hit'), 'Second submission failed to reuse COLMAP'
        print('PASS: upload, queue, real SfM + Brush, final PLY download and cache reuse',flush=True)
    finally:
        server.shutdown()
        api._executor.shutdown(wait=True)

if __name__=='__main__': main(sys.argv[1])
