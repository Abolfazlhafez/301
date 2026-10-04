import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, SxProps, Theme } from "@mui/material";
import { photosApi, getPhotoUrl } from "../../shared/api/photosApi";
import { useLazyPhotoSrc } from "../../shared/hooks/useLazyPhotoSrc";

interface WorkerAvatarProps {
  avatarPhotoId: string | null;
  initials: string;
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * نمایش عکس پروفایل یک نیرو. اگر عکسی ثبت نشده باشد یا بارگذاری آن با خطا
 * مواجه شود (مثلاً فایل حذف‌شده یا HEIC تبدیل‌نشده)، به‌جای شکستن ظاهر صفحه،
 * یک Avatar پیش‌فرض حاوی حروف اول نام نمایش داده می‌شود.
 */
export function WorkerAvatar({ avatarPhotoId, initials, size = 44, sx }: WorkerAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const { data: photo } = useQuery({
    queryKey: ["photo", avatarPhotoId],
    queryFn: () => photosApi.getById(avatarPhotoId as string),
    enabled: !!avatarPhotoId,
  });

  // آواتار هم فقط پیش‌نمایش کم‌حجم را می‌گیرد (چند ده آواتار هم‌زمان = چند ده عکس بزرگ در RAM).
  const lazy = useLazyPhotoSrc(photo ?? { filename: "" });
  const hasUrl = !!photo && !!getPhotoUrl(photo.filename);
  const showImage =
    !!avatarPhotoId && !!photo && hasUrl && !photo.displayConversionFailed && !loadFailed && !lazy.isPlaceholder;

  return (
    <Avatar
      ref={lazy.ref}
      src={showImage ? lazy.src : undefined}
      imgProps={{ onError: () => setLoadFailed(true) }}
      sx={{
        width: size,
        height: size,
        bgcolor: "primary.main",
        fontWeight: 700,
        fontSize: size / 2.4,
        ...sx,
      }}
    >
      {!showImage && initials}
    </Avatar>
  );
}
