/**
 * 媒体直传（单一实现，媒体库页与内容页选择器共用）。
 *
 * 流程与后端契约一致（Spec 14.5）：先 POST 换上传目标，再把文件原样传上去。
 * 服务器本地磁盘形态下，上传目标是后端自己的 PUT 端点；对象存储形态下是 COS，
 * 需要引入 COS SDK 直传 —— 未接入时**明确报错**，而不是假装成功。
 *
 * 之前两处（MediaPage / MediaPicker）都是"取完凭证就 sleep 200/300ms"的桩，
 * 看起来上传成功、实际上什么都没传，媒体库里永远只有元数据没有文件。
 */
import { adminApi } from '../../lib/api';
import { putBinary } from '../../lib/http';
import type { MediaUploadRequest, MediaUploadResult } from '../../types/api';

export type MediaFolder = 'books' | 'songs' | 'covers' | 'icons' | 'misc';

export async function uploadMediaFile(
  file: File,
  folder: MediaFolder,
  extra?: Partial<MediaUploadRequest>,
): Promise<MediaUploadResult> {
  const req: MediaUploadRequest = {
    folder,
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    ...extra,
  };

  // 1) 先换上传目标（后端同时落元数据）
  const res = await adminApi.requestUpload(req);

  // 2) 再把文件字节传上去
  const target = res.upload;
  if (target.driver === 'local') {
    await putBinary(target.uploadPath, file, target.headers['Content-Type'] ?? file.type);
    return res;
  }

  throw new Error(
    '对象存储直传尚未接入：当前后端为 COS 形态但控制台未实现 COS SDK 上传，' +
      '请把后端 MEDIA_DRIVER 设为 local（服务器本地磁盘）后重试',
  );
}
