import DesktopWidget from '@/features/electron/renderer/DesktopWidget'
import './widget.css'

/**
 * Electron 위젯 창 전용 화면. 웹에서는 빈 화면이다.
 * 루트 표식(.onmaum-widget-root)은 서버 렌더 HTML에 항상 들어가 첫 화면부터 배경이 투명하다.
 */
export default function WidgetPage() {
  return (
    <div className="onmaum-widget-root">
      <DesktopWidget />
    </div>
  )
}
