# ME-rPPG 모델 (spike)

- 출처: https://github.com/Health-HCI-Group/ME-rPPG-demo (commit 66c139d9d215c08b12d7ed2cea4307d71b679220)
- 라이선스: Apache License 2.0 (같은 폴더 `LICENSE`)
- 논문: Wang et al., "Memory-efficient Low-latency Remote Photoplethysmography through
  Temporal-Spatial State Space Duality", arXiv:2504.01774
- `model.onnx`: 원본 그대로
- `state.bin` + `state-shapes.json`: 원본 `state.json`(초기 상태 36개 텐서)을 float32 리틀엔디언
  바이너리로 변환한 것 (값 동일, 7.2MB → 1.5MB)
