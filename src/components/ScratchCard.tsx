import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";

const BRUSH_RADIUS = 20; // 笔刷直径 40px
const REVEAL_THRESHOLD = 0.5; // 刮开超过 50% 自动揭晓
const SAMPLE_STRIDE = 24; // 透明度采样步长（像素）
const MAX_DPR = 2; // 限制像素比，避免高分屏读像素卡顿

interface Props {
  /** 已完成的区域直接展示内容，不再渲染覆盖层 */
  revealed: boolean;
  onComplete: () => void;
  children: ReactNode;
}

/**
 * 单个刮除区域：Canvas 覆盖层 + 指针轨迹擦除 + 50% 自动揭晓。
 * 产品规则要求必须真实刮除，单个区域不提供点击/键盘直接翻开；
 * 无法使用指针的用户可通过“一键刮开”按钮完成整张票。
 */
export function ScratchCard({ revealed, onComplete, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const { t } = useI18n();
  const hint = t("scratchHint");
  // 覆盖层上的提示文字只在绘制时取当前语言，切换语言不重绘（避免清空刮除进度）
  const hintRef = useRef(hint);
  hintRef.current = hint;

  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const card = canvas.parentElement;
    if (!card) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let finished = false;
    let drawing = false;
    let painted = false;
    let strokesSinceCheck = 0;
    let lastPoint: { x: number; y: number } | null = null;
    let paintedWidth = 0;
    let paintedHeight = 0;

    const paintCover = () => {
      const rect = card.getBoundingClientRect();
      // 布局尚未完成时跳过，ResizeObserver 会在尺寸就绪后补绘
      if (rect.width === 0 || rect.height === 0) return;
      painted = true;
      paintedWidth = rect.width;
      paintedHeight = rect.height;
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DPR);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#d8d8dc");
      gradient.addColorStop(0.45, "#9ea0a8");
      gradient.addColorStop(1, "#ededf0");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = "rgba(255,255,255,.22)";
      for (let y = 8; y < rect.height; y += 12) ctx.fillRect(0, y, rect.width, 2);

      ctx.fillStyle = "#4b4d56";
      ctx.font = "800 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hintRef.current, rect.width / 2, rect.height / 2);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      canvas.style.transition = "opacity .25s ease";
      canvas.style.opacity = "0";
      canvas.style.pointerEvents = "none";
      completeRef.current();
    };

    const clearedRatio = () => {
      // 覆盖层尚未绘制时画布是透明的，不能误判为“已刮开”
      if (!painted) return 0;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let cleared = 0;
      let sampled = 0;
      for (let i = 3; i < data.length; i += 4 * SAMPLE_STRIDE) {
        sampled++;
        if (data[i] === 0) cleared++;
      }
      return sampled === 0 ? 0 : cleared / sampled;
    };

    const scratch = (clientX: number, clientY: number) => {
      if (finished || !painted) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      ctx.globalCompositeOperation = "destination-out";
      // 用线段连接相邻采样点，快速滑动不会留下断点
      if (lastPoint) {
        ctx.beginPath();
        ctx.lineWidth = BRUSH_RADIUS * 2;
        ctx.lineCap = "round";
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      lastPoint = { x, y };
      // 逐笔读取像素代价高，节流为每 4 笔检测一次
      if (++strokesSinceCheck >= 4) {
        strokesSinceCheck = 0;
        if (clearedRatio() > REVEAL_THRESHOLD) finish();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      drawing = true;
      lastPoint = null;
      canvas.setPointerCapture(e.pointerId);
      scratch(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drawing) scratch(e.clientX, e.clientY);
    };
    const onPointerEnd = () => {
      drawing = false;
      lastPoint = null;
      if (!finished && clearedRatio() > REVEAL_THRESHOLD) finish();
    };

    paintCover();
    // 旋转屏幕/窗口缩放后覆盖层尺寸失真，重绘该未完成区域
    const resizeObserver = new ResizeObserver((entries) => {
      if (finished || drawing) return;
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (Math.abs(rect.width - paintedWidth) > 2 || Math.abs(rect.height - paintedHeight) > 2) {
        paintCover();
      }
    });
    resizeObserver.observe(card);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [revealed]);

  return (
    <div className="scratch-card">
      {/* 未揭晓的内容对辅助技术隐藏，避免屏幕阅读器提前读出结果 */}
      <div className="reveal-content" aria-hidden={!revealed}>
        {children}
      </div>
      {!revealed && <canvas ref={canvasRef} className="scratch-layer" aria-hidden="true" />}
    </div>
  );
}
