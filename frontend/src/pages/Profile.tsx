import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";

interface Profile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  bio: string | null;
  university: string | null;
  course: string | null;
  year_of_study: string | null;
  profile_picture: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
}

interface Post {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface EditForm {
  first_name: string;
  last_name: string;
  bio: string;
  university: string;
  course: string;
  year_of_study: string;
}

function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editing, setEditing] = useState(false);

  const [editForm, setEditForm] = useState<EditForm>({
    first_name: "",
    last_name: "",
    bio: "",
    university: "",
    course: "",
    year_of_study: "",
  });

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      let id: number;

      if (userId) {
        id = Number(userId);

        if (isNaN(id)) {
          setError("Invalid user ID.");
          return;
        }
      } else {
        const meResponse = await api.get("/users/me");

        id = meResponse.data.id;
      }

      const [profileResponse, postsResponse] =
        await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/posts`),
        ]);

      const profileData = profileResponse.data;

      setProfile(profileData);
      setPosts(postsResponse.data);

      setEditForm({
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        bio: profileData.bio || "",
        university: profileData.university || "",
        course: profileData.course || "",
        year_of_study: profileData.year_of_study || "",
      });

    } catch (error: any) {
      console.error("Failed to load profile:", error);

      if (error.response?.status === 404) {
        setError("User profile not found.");
      } else if (error.response?.status === 401) {
        setError("Please log in again.");
      } else {
        setError("Failed to load profile.");
      }

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // =====================================================
  // HANDLE FORM CHANGE
  // =====================================================

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // =====================================================
  // START EDITING
  // =====================================================

  function startEditing() {
    if (!profile) return;

    setEditForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      bio: profile.bio || "",
      university: profile.university || "",
      course: profile.course || "",
      year_of_study: profile.year_of_study || "",
    });

    setSuccess("");
    setError("");
    setEditing(true);
  }

  // =====================================================
  // CANCEL EDITING
  // =====================================================

  function cancelEditing() {
    if (!profile) return;

    setEditForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      bio: profile.bio || "",
      university: profile.university || "",
      course: profile.course || "",
      year_of_study: profile.year_of_study || "",
    });

    setEditing(false);
    setError("");
  }

  // =====================================================
  // SAVE PROFILE
  // =====================================================

  async function saveProfile() {
    if (!profile) return;

    if (!editForm.first_name.trim()) {
      setError("First name is required.");
      return;
    }

    if (!editForm.last_name.trim()) {
      setError("Last name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put(
        "/users/me",
        {
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          bio: editForm.bio.trim() || null,
          university:
            editForm.university.trim() || null,
          course:
            editForm.course.trim() || null,
          year_of_study:
            editForm.year_of_study.trim() || null,
        }
      );

      /*
       * If editing your own profile, use the
       * response directly.
       */
      if (!userId) {
        setProfile((previous) => ({
          ...previous!,
          ...response.data,
        }));
      } else {
        /*
         * This shouldn't normally happen because
         * Edit Profile is only available on /profile,
         * but reload if needed.
         */
        await loadProfile();
      }

      setEditing(false);
      setSuccess("Profile updated successfully.");

    } catch (error: any) {
      console.error("Failed to update profile:", error);

      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError("Failed to update profile.");
      }

    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // PROFILE PHOTO
  // =====================================================

  async function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile picture must be less than 5MB.");
      return;
    }

    try {
      setUploadingPhoto(true);
      setError("");
      setSuccess("");

      const formData = new FormData();

      formData.append("photo", file);

      const response = await api.put(
        "/users/me/photo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setProfile(response.data);

      setSuccess(
        "Profile picture updated successfully."
      );

    } catch (error: any) {
      console.error(
        "Failed to upload profile picture:",
        error
      );

      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError(
          "Failed to upload profile picture."
        );
      }

    } finally {
      setUploadingPhoto(false);

      event.target.value = "";
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-white rounded-xl shadow-md p-8 text-center">

          <div className="text-3xl mb-3">
            ⏳
          </div>

          <p className="text-gray-600">
            Loading profile...
          </p>

        </div>
      </MainLayout>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error && !profile) {
    return (
      <MainLayout>
        <div className="bg-white rounded-xl shadow-md p-8 text-center">

          <div className="text-4xl mb-4">
            😕
          </div>

          <h2 className="text-xl font-bold text-gray-800">
            {error}
          </h2>

          <button
            onClick={() => navigate("/search")}
            className="mt-5 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg"
          >
            Back to Search
          </button>

        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return null;
  }

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  const profileImage = profile.profile_picture
    ? `http://127.0.0.1:8000${profile.profile_picture}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        `${profile.first_name} ${profile.last_name}`
      )}&background=dc2626&color=ffffff&size=200`;

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <MainLayout>

      {/* =================================================
          ALERTS
      ================================================== */}

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
          {success}
        </div>
      )}

      {/* =================================================
          PROFILE CARD
      ================================================== */}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">

        {/* COVER */}

        <div className="h-36 bg-gradient-to-r from-red-600 to-red-400" />

        <div className="px-6 pb-6">

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="flex flex-col md:flex-row md:items-end md:justify-between">

            <div className="flex items-end -mt-16">

              {/* PROFILE PHOTO */}

              <div className="relative">

                <img
                  src={profileImage}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                />

                {/* CHANGE PHOTO */}

                {!userId && (
                  <label
                    htmlFor="profile-photo"
                    className="absolute bottom-1 right-1 bg-red-600 hover:bg-red-700 text-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-md"
                    title="Change profile picture"
                  >
                    📷
                  </label>
                )}

                {!userId && (
                  <input
                    id="profile-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                )}

              </div>

              {/* NAME */}

              <div className="ml-4 mb-2">

                <h1 className="text-2xl font-bold">
                  {profile.first_name}{" "}
                  {profile.last_name}
                </h1>

                <p className="text-gray-500">
                  {profile.email}
                </p>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="mt-4 md:mt-0 flex gap-2">

              {!userId && !editing && (
                <button
                  onClick={startEditing}
                  disabled={uploadingPhoto}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-5 py-2 rounded-lg transition"
                >
                  ✏️ Edit Profile
                </button>
              )}

              {userId && (
                <button
                  onClick={() => navigate(-1)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded-lg transition"
                >
                  ← Back
                </button>
              )}

            </div>

          </div>

          {/* =================================================
              EDIT FORM
          ================================================== */}

          {editing && !userId ? (

            <div className="mt-8 border-t pt-6">

              <h2 className="text-xl font-bold mb-5">
                Edit Your Profile
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* FIRST NAME */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>

                  <input
                    type="text"
                    name="first_name"
                    value={editForm.first_name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />

                </div>

                {/* LAST NAME */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>

                  <input
                    type="text"
                    name="last_name"
                    value={editForm.last_name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />

                </div>

                {/* UNIVERSITY */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    University
                  </label>

                  <input
                    type="text"
                    name="university"
                    value={editForm.university}
                    onChange={handleChange}
                    placeholder="Your university"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />

                </div>

                {/* COURSE */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course
                  </label>

                  <input
                    type="text"
                    name="course"
                    value={editForm.course}
                    onChange={handleChange}
                    placeholder="Your course"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />

                </div>

                {/* YEAR */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year of Study
                  </label>

                  <input
                    type="text"
                    name="year_of_study"
                    value={editForm.year_of_study}
                    onChange={handleChange}
                    placeholder="e.g. Year 2"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />

                </div>

              </div>

              {/* BIO */}

              <div className="mt-5">

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>

                <textarea
                  name="bio"
                  value={editForm.bio}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Tell people about yourself..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                />

              </div>

              {/* FORM BUTTONS */}

              <div className="flex justify-end gap-3 mt-5">

                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 px-5 py-2 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-5 py-2 rounded-lg"
                >
                  {saving
                    ? "Saving..."
                    : "💾 Save Changes"}
                </button>

              </div>

            </div>

          ) : (

            <>
              {/* =================================================
                  BIO
              ================================================== */}

              <div className="mt-6">

                <p className="text-gray-700">
                  {profile.bio || "No bio yet."}
                </p>

              </div>

              {/* =================================================
                  EDUCATION
              ================================================== */}

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="bg-gray-50 rounded-lg p-4">

                  <p className="text-sm text-gray-500">
                    University
                  </p>

                  <p className="font-semibold">
                    {profile.university ||
                      "Not specified"}
                  </p>

                </div>

                <div className="bg-gray-50 rounded-lg p-4">

                  <p className="text-sm text-gray-500">
                    Course
                  </p>

                  <p className="font-semibold">
                    {profile.course ||
                      "Not specified"}
                  </p>

                </div>

                <div className="bg-gray-50 rounded-lg p-4">

                  <p className="text-sm text-gray-500">
                    Year of Study
                  </p>

                  <p className="font-semibold">
                    {profile.year_of_study ||
                      "Not specified"}
                  </p>

                </div>

              </div>

              {/* =================================================
                  COUNTS
              ================================================== */}

              <div className="flex gap-8 mt-6 border-t pt-5">

                <div>
                  <p className="text-xl font-bold">
                    {profile.posts_count}
                  </p>

                  <p className="text-gray-500 text-sm">
                    Posts
                  </p>
                </div>

                <div>
                  <p className="text-xl font-bold">
                    {profile.followers_count}
                  </p>

                  <p className="text-gray-500 text-sm">
                    Followers
                  </p>
                </div>

                <div>
                  <p className="text-xl font-bold">
                    {profile.following_count}
                  </p>

                  <p className="text-gray-500 text-sm">
                    Following
                  </p>
                </div>

              </div>
            </>

          )}

        </div>

      </div>

      {/* =================================================
          POSTS
      ================================================== */}

      <div className="mt-6">

        <h2 className="text-xl font-bold mb-4">

          {userId
            ? `${profile.first_name}'s Posts`
            : "My Posts"}

        </h2>

        {posts.length === 0 ? (

          <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">

            {userId
              ? "This user hasn't created any posts yet."
              : "You haven't created any posts yet."}

          </div>

        ) : (

          <div className="space-y-5">

            {posts.map((post) => (

              <div
                key={post.id}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >

                <div className="p-5">

                  <p className="whitespace-pre-wrap text-gray-800">
                    {post.content}
                  </p>

                  <p className="text-sm text-gray-500 mt-3">
                    {new Date(
                      post.created_at
                    ).toLocaleString()}
                  </p>

                </div>

                {post.image_url && (

                  <img
                    src={
                      post.image_url.startsWith("http")
                        ? post.image_url
                        : `http://127.0.0.1:8000${post.image_url}`
                    }
                    alt="Post"
                    className="w-full max-h-[500px] object-cover"
                  />

                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </MainLayout>
  );
}

export default Profile;