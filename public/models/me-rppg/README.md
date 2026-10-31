# ME-rPPG 모델 (spike)

- 출처: https://github.com/Health-HCI-Group/ME-rPPG-demo (commit 66c139d9d215c08b12d7ed2cea4307d71b679220)
- 라이선스: Apache License 2.0 (같은 폴더 `LICENSE`)
- 논문: Wang et al., "Memory-efficient Low-latency Remote Photoplethysmography through
  Temporal-Spatial State Space Duality", arXiv:2504.01774
- `model.onnx`: 원본 그대로
- `state.bin` + `state-shapes.json`: 원본 `state.json`(초기 상태 36개 텐서)을 float32 리틀엔디언
  바이너리로 변환한 것 (값 동일, 7.2MB → 1.5MB)
- 팀 레포 반입: `woobin-01/onmaum` `spike/rppg` 커밋 b4d7a4f14cc936c635257b693ee8a91d86e84788
- SHA-256
  - `model.onnx`: 9e0277fa4c0fb486c52818775fc83450901fc4d76e0ff98da64124443211e093
  - `state.bin`: 532cf0038ec5dc65235d7111660dbe46a4e8df4991245a906362d37ad6ce8cf8
  - `state-shapes.json`: 286b337c528f7e61188bc11041568ca8383e8c909c6f3a07f3dab2b6016c790e
