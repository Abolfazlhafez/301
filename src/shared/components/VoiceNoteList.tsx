import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTranslation } from "react-i18next";
import type { VoiceNoteRelatedType } from "../../entities/VoiceNote";
import { voiceNoteService, resolveVoiceNoteUrl } from "../../core/services/voiceNoteService";
import { extractErrorMessage } from "../../core/errors";
import { useToast } from "./ToastProvider";

interface VoiceNoteListProps {
  relatedType: VoiceNoteRelatedType;
  relatedId: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceNoteList({ relatedType, relatedId }: VoiceNoteListProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["voiceNotes", relatedType, relatedId];

  const { data: voiceNotes } = useQuery({
    queryKey,
    queryFn: () => voiceNoteService.list({ relatedType, relatedId }),
    enabled: !!relatedId,
  });

  async function handleDelete(id: string) {
    try {
      await voiceNoteService.remove(id);
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
    }
  }

  if (!voiceNotes || voiceNotes.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t("voiceNote.empty")}
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {voiceNotes.map((note) => (
        <Stack key={note.id} direction="row" alignItems="center" spacing={1}>
          <Box component="audio" controls src={resolveVoiceNoteUrl(note.id)} sx={{ flex: 1, height: 36 }} />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
            {formatDuration(note.durationSeconds)}
          </Typography>
          <IconButton size="small" onClick={() => handleDelete(note.id)} aria-label={t("common.delete") as string}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
    </Stack>
  );
}
