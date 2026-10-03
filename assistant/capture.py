"""Windows DXGI capture with a bounded latest-frame buffer and BGR output."""
import time


def capture_frames(stop, on_frame, report, *, device=0, output=0, fps=60):
    import dxcam  # Lazy import keeps the event test command dependency-free.

    with dxcam.create(device_idx=device, output_idx=output, backend="dxgi",
                      output_color="BGR", processor_backend="cv2", max_buffer_len=2) as camera:
        camera.start(target_fps=fps)
        last_timestamp = None
        last_seen = time.perf_counter()
        last_report = last_seen - 1
        count = 0
        width = height = 0
        while not stop.is_set():
            if not camera.is_capturing:
                raise RuntimeError("DXcam capture stopped unexpectedly.")
            iteration = time.perf_counter()
            timestamp = camera.latest_frame_time
            if timestamp is not None and timestamp != last_timestamp:
                frame = camera.grab(copy=True)  # Nonblocking latest-frame read during threaded capture.
                if frame is not None:
                    last_timestamp = timestamp
                    last_seen = iteration
                    height, width = frame.shape[:2]
                    count += 1
                    on_frame(frame)
            if iteration - last_report >= 1:
                report(capture="capturing" if width and iteration - last_seen < 2 else "waiting",
                       width=width, height=height, fps=round(count / (iteration - last_report), 1))
                last_report = iteration
                count = 0
            stop.wait(max(0, 1 / fps - (time.perf_counter() - iteration)))
        # The context manager stops the DXcam thread and releases DXGI resources.
