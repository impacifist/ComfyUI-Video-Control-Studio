# 워크플로우 가이드

[English](WORKFLOWS.md)

GitHub의 **Raw / Download raw file**로 JSON을 다운로드하고 ComfyUI 캔버스에 드래그합니다. 영상은 포함하지 않으므로 Load Video에서 직접 업로드하세요.

## 추출·비교·저장

[한국어 워크플로우](../examples/video-control-studio-ko.json) · [영어 워크플로우](../examples/video-control-studio-en.json)

**Load Video → Video Control Studio → Save Video**

모델이 필요 없는 Canny부터 시작하세요. 2초 정도의 구간을 정하고 **한 프레임 시험**으로 임계값을 확인한 다음 **선택 구간 추출**을 실행합니다. A/B에서 원본과 윤곽선을 고르고 비교선을 움직입니다.

저장하려면 ComfyUI 상단의 **실행**을 누릅니다. 노드 내부 버튼은 추출까지만 실행합니다. Save Video에서 MP4/H.264를 선택하면 일반적인 플레이어에서 볼 수 있습니다. 제어 영상은 무음입니다.

Pose·Depth는 모델을 설치하고 목록 갱신 또는 재시작 후 세부 설정에서 선택합니다. ControlNet 출력도 원하는 종류로 변경한 다음 다시 추출하세요.

## H3 Pose ControlNet 생성

[한국어 워크플로우](../examples/h3-pose-controlnet-ko.json) · [영어 워크플로우](../examples/h3-pose-controlnet-en.json)

**control_frames를 MiniMax H3 Fun ControlNet에 직접 연결**한 예제입니다. ComfyUI 기본 노드와 Video Control Studio만 사용합니다.

| 로더 | 모델 / 폴더 |
| --- | --- |
| Load Diffusion Model | H3 FL2VA / `models/diffusion_models` |
| Load CLIP | H3 Qwen3-VL, type은 `minimax` / `models/text_encoders` |
| Load VAE | H3 비디오 VAE / `models/vae` |
| Load Model Patch | H3 Fun ControlNet Union 2.0 / `models/model_patches` |
| Load LoRA (Model Only) | 호환 FL2V 8-step Turbo LoRA / `models/loras` |
| Video Control Studio | SDPose Wholebody / `models/checkpoints` |

출처: [Comfy-Org MiniMax H3](https://huggingface.co/Comfy-Org/MiniMax-H3), [SDPose](https://huggingface.co/Comfy-Org/SDPose), [공식 ControlNet 예제](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_fun_controlnet_union.json). 모델의 라이선스와 하드웨어 요구사항은 별도입니다.

1. 주인물이 잘 보이고 장면 전환이 없는 영상으로 시작합니다.
2. **24 FPS·약 5.17초**를 추출하면 **124프레임**을 공급할 수 있습니다. 짧으면 기본 H3 ControlNet이 마지막 프레임을 유지합니다.
3. **한 프레임 시험 → 선택 구간 추출**로 확인합니다.
4. H3 Reference to Video의 프롬프트를 수정합니다. 기본 예제에는 외형 참조가 없으며 Pose는 자세·움직임을 전달합니다.
5. 전체 워크플로우를 실행합니다. 기본값은 512×288·124프레임·8스텝이며 호환 Turbo LoRA가 필요합니다. LoRA를 빼면 기본 모델에 권장되는 샘플링 설정을 사용하세요.

Reference to Video 노드를 참조 이미지 없이 쓰며, 검증한 FL2VA 구성을 따릅니다. 영상만 저장하고 오디오 디코딩은 생략했습니다. 사진 참조·마스크·인물 교체는 호환 모델을 사용해 후속 H3 워크플로우에서 구성합니다. Video Control Studio는 제어 맵을 제공합니다.

## 문제 해결

| 증상 | 확인할 내용 |
| --- | --- |
| 누락 노드 | 설치 위치, ComfyUI 재시작·브라우저 새로고침, 기본 전처리 노드를 확인합니다. |
| 모델 오류 | 각 로더에서 설치된 파일을 선택합니다. 하위 폴더는 예제와 다를 수 있습니다. |
| 한 프레임 출력 | 시험 후 선택 구간 추출을 실행합니다. |
| 이전 결과 | 추출 설정이나 출력 종류를 바꾸면 다시 추출합니다. |
| 재시작 후 미리보기 없음 | 임시 파일이 정리됐을 수 있으므로 다시 추출합니다. |
| 저장되지 않음 | 노드 내부 버튼 대신 상단 실행을 사용합니다. |
| 포즈 대상이 다름 | 현재는 화면 전체에서 한 명을 추정합니다. 대상이 분명한 샷으로 좁힙니다. |
| RAM 사용량이 큼 | 구간·해상도·종류를 줄입니다. 배치 크기만으로 전체 영상 메모리가 제한되지는 않습니다. |
| 서브그래프 실행 오류 | ComfyUI 상단 실행을 사용합니다. |
