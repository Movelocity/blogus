import { refreshSession, SessionExpiredError, uploadFile } from "../../../lib/api";
import type { ToastType } from "../../../lib/toast";
import { $createAttachmentNode } from "../../../components/rich-editor/nodes/AttachmentNode";
import { $createImageNode } from "../../../components/rich-editor/nodes/ImageNode";
import { createAssetRef } from "../assets";

export type UploadResult =
  | { kind: "image"; url: string; asset: ReturnType<typeof createAssetRef> }
  | { kind: "attachment"; node: ReturnType<typeof $createAttachmentNode>; asset: ReturnType<typeof createAssetRef> };

export async function uploadImageOrAttachment(
  file: File,
  notify: (message: string, type?: ToastType) => void,
  onAsset?: (asset: ReturnType<typeof createAssetRef>) => void,
): Promise<UploadResult | null> {
  const loggedIn = await refreshSession();
  if (!loggedIn) {
    notify("需要登录才能上传", "error");
    return null;
  }

  try {
    const { file: uploaded } = await uploadFile(file);
    const asset = createAssetRef(file, uploaded);
    onAsset?.(asset);

    if (file.type.startsWith("image/")) {
      return { kind: "image", url: uploaded.url, asset };
    }

    const node = $createAttachmentNode({
      assetId: asset.id,
      fileName: asset.name,
      mime: asset.mime,
      url: asset.url,
      size: asset.size,
    });
    return { kind: "attachment", node, asset };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      notify("需要登录才能上传", "error");
    } else {
      notify("上传失败，请稍后重试", "error");
    }
    return null;
  }
}

export async function uploadImageFile(
  file: File,
  notify: (message: string, type?: ToastType) => void,
  onAsset?: (asset: ReturnType<typeof createAssetRef>) => void,
): Promise<string | null> {
  const result = await uploadImageOrAttachment(file, notify, onAsset);
  if (!result || result.kind !== "image") return null;
  return result.url;
}
