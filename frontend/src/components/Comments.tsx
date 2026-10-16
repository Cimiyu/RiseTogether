import { useEffect, useState } from "react";
import api from "../api/axios";

interface Comment {
  id: number;
  content: string;
  owner_id: number;
  created_at: string;
}

interface Props {
  postId: number;
}

function Comments({ postId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");

  async function loadComments() {
    try {
      const response = await api.get(`/comments/posts/${postId}`);
      setComments(response.data);
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  }

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function createComment() {
    if (!content.trim()) return;

    try {
      await api.post(`/comments/posts/${postId}`, {
        content: content.trim(),
      });

      setContent("");
      await loadComments();
    } catch (error) {
      console.error("Failed to create comment:", error);
      alert("Failed to comment.");
    }
  }

  return (
    <div className="mt-4">

      <input
        className="border rounded p-2 w-full"
        placeholder="Write a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            createComment();
          }
        }}
      />

      <button
        onClick={createComment}
        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Comment
      </button>

      <div className="mt-4 space-y-2">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="bg-gray-100 rounded p-3"
          >
            <p>{comment.content}</p>

            <small>
              {new Date(comment.created_at).toLocaleString()}
            </small>
          </div>
        ))}
      </div>

    </div>
  );
}

export default Comments;