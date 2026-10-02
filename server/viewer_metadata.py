"""Camera poses for viewing a reconstruction in its original COLMAP coordinates."""
from pathlib import Path


def camera_metadata(job_dir: Path):
    import pycolmap

    reconstruction = pycolmap.Reconstruction(str(job_dir / 'sparse' / '0'))
    cameras = []
    for image in sorted(reconstruction.images.values(), key=lambda item: item.name):
        if not image.has_pose:
            continue
        camera = reconstruction.cameras[image.camera_id]
        cameras.append(dict(
            name=image.name,
            width=camera.width,
            height=camera.height,
            intrinsics=camera.calibration_matrix().tolist(),
            worldFromCamera=image.cam_from_world().inverse().matrix().tolist(),
        ))
    return dict(cameras=cameras)
