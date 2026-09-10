import type { LexicalEditor } from "lexical";
import { $insertNodes } from "lexical";
import { refreshSession, SessionExpiredError, uploadFile } from "../../../lib/api";
import type { ToastType } from "../../../lib/toast";
import { $createAttachmentNode } from "../../../components/rich-editor/nodes/AttachmentNode";
import { $createImageNode } from "../../../components/rich-editor/nodes/ImageNode";
import { createAssetRef, type AssetRef } from "../assets";

export type AttachmentPayload = {
  assetId: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
};

export type UploadResult =
  | { kind: "image"; url: string; asset: AssetRef }
  | { kind: "attachment"; asset: AssetRef; attachment: AttachmentPayload };

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export async function uploadImageOrAttachment(
  file: File,
  notify: (message: string, type?: ToastType) => void,
): Promise<UploadResult | null> {
  const loggedIn = await refreshSession();
  if (!loggedIn) {
    notify("需要登录才能上传", "error");
    return null;
  }

  try {
    const { file: uploaded } = await uploadFile(file);
    const asset = createAssetRef(file, uploaded);

    if (isImageFile(file)) {
      return { kind: "image", url: uploaded.url, asset };
    }

    return {
      kind: "attachment",
      asset,
      attachment: {
        assetId: asset.id,
        fileName: asset.name,
        mime: asset.mime,
        url: asset.url,
        size: asset.size,
      },
    };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      notify("需要登录才能上传", "error");
    } else {
      notify("上传失败，请稍后重试", "error");
    }
    return null;
  }
}

export function insertUploadResult(
  editor: LexicalEditor,
  result: UploadResult,
  addAsset?: (asset: AssetRef) => void,
) {
  editor.update(() => {
    if (result.kind === "image") {
      $insertNodes([$createImageNode({ src: result.url, alt: result.asset.name })]);
      return;
    }
    $insertNodes([$createAttachmentNode(result.attachment)]);
  });
  addAsset?.(result.asset);
}

export async function uploadImageFile(
  file: File,
  notify: (message: string, type?: ToastType) => void,
): Promise<string | null> {
  const result = await uploadImageOrAttachment(file, notify);
  if (!result || result.kind !== "image") return null;
  return result.url;
}
