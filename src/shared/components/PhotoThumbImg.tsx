import { Avatar, Box } from "@mui/material";
import type { AvatarProps, BoxProps } from "@mui/material";
import { useLazyPhotoSrc } from "../hooks/useLazyPhotoSrc";

type PhotoRef = { id?: string; filename: string };

type PhotoThumbImgProps = Omit<BoxProps<"img">, "component" | "src" | "ref"> & { photo: PhotoRef };

/**
 * <img> با پیش‌نمایش کم‌حجم، بارگذاری تنبل و آزادسازی خارج از دید.
 * جایگزین مستقیم `<Box component="img" src={getPhotoUrl(...)} />` در لیست‌ها و کاشی‌هاست.
 * عکس اصلی را فقط جاهایی نشان بده که کاربر آن را صراحتاً باز کرده (لایت‌باکس).
 */
export function PhotoThumbImg({ photo, sx, ...rest }: PhotoThumbImgProps) {
  const lazy = useLazyPhotoSrc(photo);
  return (
    <Box
      component="img"
      decoding="async"
      {...rest}
      ref={lazy.ref}
      src={lazy.src}
      sx={[
        lazy.isPlaceholder ? { bgcolor: "action.hover", minHeight: lazy.minHeight } : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

type LazyPhotoAvatarProps = Omit<AvatarProps, "src" | "ref"> & { photo: PhotoRef | null | undefined };

/**
 * Avatar با همان سیاست حافظه. تا وقتی پیش‌نمایش آماده نیست، محتوای جایگزین (children)
 * دیده می‌شود؛ هیچ عکس بزرگی باز نمی‌شود.
 */
export function LazyPhotoAvatar({ photo, children, ...rest }: LazyPhotoAvatarProps) {
  const lazy = useLazyPhotoSrc(photo ?? { filename: "" });
  return (
    <Avatar {...rest} ref={lazy.ref} src={photo && !lazy.isPlaceholder ? lazy.src : undefined}>
      {children}
    </Avatar>
  );
}
