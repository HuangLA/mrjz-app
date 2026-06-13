import { Image as TaroImage } from "@tarojs/components";
import type { ComponentProps } from "react";

type SmartImageProps = ComponentProps<typeof TaroImage>;

export function SmartImage(props: SmartImageProps) {
  return <TaroImage {...props} />;
}
