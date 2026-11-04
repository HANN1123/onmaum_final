# FacePhys 모델 (실험실 비교용)

- 출처: https://github.com/pengfaliu/FacePhys-Release (commit 07a140294bf81dca5b907fc725ec64ef461a650d)
- 라이선스: MIT + Privacy Protection Addendum (같은 폴더 `LICENSE`)
  - 모든 생체 추론·신호처리는 사용자 기기 안에서만 한다(동의로도 면제되지 않음). 서버 추론·원본 영상 전송 금지
  - 파생 생리 지표를 기기 밖으로 보내려면 명시적·철회 가능한 동의가 필요하다
  - 생리 데이터 수집 전 명시적 동의, 재배포 시 같은 보장 유지
  - 연구용 모델이며 의료기기가 아니다. 학습 데이터(RLAP)는 별도 라이선스이고 이 라이선스로 권리가 생기지 않는다
- 논문: Wang et al., "FacePhys: State of the Heart Learning", arXiv:2512.06275 (ME-rPPG 후속)
- `model.onnx`: 원본 `weights/model.onnx` 그대로
- `state.bin` + `state-shapes.json`: 원본 `weights/state.gz`(JSON, 초기 상태 46개 텐서)를 ME-rPPG와 같은
  float32 리틀엔디언 바이너리로 변환한 것 (값 동일)
- 입출력: 입력 `input`[1,1,36,36,3](RGB/255), `dt`[1](초), `state_in_0..45` / 출력 `Identity:0`=BVP,
  `Identity_i:0` → 다음 `state_in_{i-1}`
- 전처리는 공식 웹 데모(KegangWangCCNU/FacePhys-Demo)와 ME-rPPG 데모가 같다: BlazeFace 상자 칼만 → 높이 1.2배·위로 20% → 36×36
- SHA-256
  - `model.onnx`: a6922c3de4c18576842cf44b4f4cef664d51b536ced466c698d8f8bfd18188ba
  - `state.bin`: 716a05f9ccfbf47f73c7acf43246f9b4bc6d34cbabd0d936769ba2ec685df17a
  - `state-shapes.json`: 05b450e436b03a6cd582063cf5e806a8084ee5899fb15db0d1fbe96f7d7c394f
