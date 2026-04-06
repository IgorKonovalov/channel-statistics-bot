import { getDb } from '../connection';

export interface Post {
  channel_id: string;
  message_id: number;
  text: string;
  post_date: string;
  post_url: string;
  photo_file_id: string | null;
}

export function upsertPost(
  channelId: string,
  messageId: number,
  text: string,
  postDate: string,
  postUrl: string,
  photoFileId?: string | null,
): void {
  getDb()
    .prepare(
      `INSERT INTO posts (channel_id, message_id, text, post_date, post_url, photo_file_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, message_id) DO UPDATE SET
         text = excluded.text,
         post_date = excluded.post_date,
         post_url = excluded.post_url,
         photo_file_id = COALESCE(excluded.photo_file_id, posts.photo_file_id)`,
    )
    .run(channelId, messageId, text, postDate, postUrl, photoFileId ?? null);
}

export function getPost(channelId: string, messageId: number): Post | undefined {
  return getDb()
    .prepare('SELECT * FROM posts WHERE channel_id = ? AND message_id = ?')
    .get(channelId, messageId) as Post | undefined;
}

export function getPostPhotoFileId(channelId: string, messageId: number): string | null {
  const row = getDb()
    .prepare('SELECT photo_file_id FROM posts WHERE channel_id = ? AND message_id = ?')
    .get(channelId, messageId) as { photo_file_id: string | null } | undefined;
  return row?.photo_file_id ?? null;
}
