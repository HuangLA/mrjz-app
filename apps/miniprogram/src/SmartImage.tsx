import { Image as TaroImage } from "@tarojs/components";
import type { ComponentProps } from "react";

type SmartImageProps = ComponentProps<typeof TaroImage>;
type SmartImageErrorEvent = Parameters<NonNullable<SmartImageProps["onError"]>>[0];

export function SmartImage(props: SmartImageProps) {
  const { onError, src, ...rest } = props;

  function handleError(event: SmartImageErrorEvent) {
    if (src) {
      console.warn("[MRJZ image] load failed", src, event.detail?.errMsg ?? event);
    }

    onError?.(event);
  }

  return <TaroImage {...rest} src={src} onError={handleError} />;
}
