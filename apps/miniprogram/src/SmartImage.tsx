import { Image as TaroImage } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";

type SmartImageProps = React.ComponentProps<typeof TaroImage>;

const CACHE_DIR_NAME = "mrjz-image-cache";

export function SmartImage(props: SmartImageProps) {
  const { src, ...rest } = props;
  const source = typeof src === "string" ? src : "";
  const [resolvedSrc, setResolvedSrc] = useState(source);

  useEffect(() => {
    let disposed = false;

    if (!shouldCacheThroughRequest(source)) {
      setResolvedSrc(source);
      return () => {
        disposed = true;
      };
    }

    setResolvedSrc("");

    void resolveRequestCachedImage(source)
      .then((localPath) => {
        if (!disposed) {
          setResolvedSrc(localPath);
        }
      })
      .catch(() => {
        if (!disposed) {
          setResolvedSrc(source);
        }
      });

    return () => {
      disposed = true;
    };
  }, [source]);

  return <TaroImage {...rest} src={resolvedSrc} />;
}

function shouldCacheThroughRequest(source: string): boolean {
  return source.startsWith("http://") && canUseLocalFileCache();
}

function canUseLocalFileCache(): boolean {
  return (
    typeof Taro.getFileSystemManager === "function" &&
    typeof Taro.env?.USER_DATA_PATH === "string" &&
    Taro.env.USER_DATA_PATH.length > 0
  );
}

async function resolveRequestCachedImage(source: string): Promise<string> {
  const fs = Taro.getFileSystemManager();
  const cacheDir = `${Taro.env.USER_DATA_PATH}/${CACHE_DIR_NAME}`;
  const filePath = `${cacheDir}/${hashString(source)}.${imageExtension(source)}`;

  try {
    fs.accessSync(filePath);
    return filePath;
  } catch {
    // Cache miss; continue to request and write the file.
  }

  try {
    fs.mkdirSync(cacheDir, true);
  } catch {
    // Directory may already exist on some base library versions.
  }

  const response = await Taro.request<ArrayBuffer>({
    url: source,
    method: "GET",
    responseType: "arraybuffer",
    timeout: 12000,
  } as Taro.request.Option);

  if (response.statusCode < 200 || response.statusCode >= 300 || !(response.data instanceof ArrayBuffer)) {
    throw new Error(`Image request failed: ${response.statusCode}`);
  }

  fs.writeFileSync(filePath, response.data);
  return filePath;
}

function imageExtension(source: string): string {
  const path = source.split("?")[0] ?? "";
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase() ?? "img";

  return /^[a-z0-9]+$/.test(ext) ? ext : "img";
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
