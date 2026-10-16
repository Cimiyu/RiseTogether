import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import { API_BASE_URL } from "../api/config";

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  bio: string | null;
  university: string | null;
  course: string | null;
  year_of_study: string | null;
  profile_picture: string | null;
  created_at: string;
}

interface ProfileForm {
  first_name: string;
  last_name: string;
  bio: string;
  university: string;
  course: string;
  year_of_study: string;
}

function Settings() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [form, setForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    bio: "",
    university: "",
    course: "",
    year_of_study: "",
  });

  const [selectedPhoto, setSelectedPhoto] =
    useState<File | null>(null);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // BACKEND URL
  // =====================================================

  const API_URL = API_BASE_URL;

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/users/me");

        const user: UserProfile = response.data;

        setProfile(user);

        setForm({
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          bio: user.bio || "",
          university: user.university || "",
          course: user.course || "",
          year_of_study: user.year_of_study || "",
        });

        setPreviewImage(null);

      } catch (err: any) {
        console.error(
          "Failed to load profile:",
          err
        );

        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
          "Failed to load your profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [navigate]);

  // =====================================================
  // HANDLE FORM CHANGES
  // =====================================================

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setError("");
  }

  // =====================================================
  // HANDLE PHOTO SELECTION
  // =====================================================

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    // Validate size - 5MB maximum
    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Profile picture must be smaller than 5MB."
      );
      return;
    }

    setSelectedPhoto(file);
    setMessage("");
    setError("");

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPreviewImage(previewUrl);
  }

  // =====================================================
  // UPLOAD PROFILE PHOTO
  // =====================================================

  async function uploadProfilePhoto() {
    if (!selectedPhoto) {
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage("");
      setError("");

      const formData = new FormData();

      formData.append(
        "photo",
        selectedPhoto
      );

      const response = await api.put(
        "/users/me/photo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updatedUser: UserProfile =
        response.data;

      setProfile(updatedUser);

      setSelectedPhoto(null);
      setPreviewImage(null);

      setMessage(
        "Profile picture updated successfully."
      );

    } catch (err: any) {
      console.error(
        "Profile photo upload failed:",
        err
      );

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Failed to upload profile picture."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  // =====================================================
  // SAVE PROFILE INFORMATION
  // =====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await api.put(
        "/users/me",
        {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          bio: form.bio.trim() || null,
          university:
            form.university.trim() || null,
          course:
            form.course.trim() || null,
          year_of_study:
            form.year_of_study || null,
        }
      );

      const updatedUser: UserProfile =
        response.data;

      setProfile(updatedUser);

      setForm({
        first_name:
          updatedUser.first_name || "",
        last_name:
          updatedUser.last_name || "",
        bio:
          updatedUser.bio || "",
        university:
          updatedUser.university || "",
        course:
          updatedUser.course || "",
        year_of_study:
          updatedUser.year_of_study || "",
      });

      setMessage(
        "Profile updated successfully."
      );

    } catch (err: any) {
      console.error(
        "Failed to update profile:",
        err
      );

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Failed to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="text-4xl mb-3">
            ⏳
          </div>

          <p className="text-gray-600">
            Loading your settings...
          </p>
        </div>
      </MainLayout>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (!profile) {
    return (
      <MainLayout>
        <div className="bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="text-4xl mb-4">
            😕
          </div>

          <h2 className="text-xl font-bold">
            Unable to load profile
          </h2>

          <p className="text-red-600 mt-2">
            {error}
          </p>

          <button
            onClick={() => navigate("/profile")}
            className="mt-5 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg"
          >
            Back to Profile
          </button>
        </div>
      </MainLayout>
    );
  }

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  const profileImage =
    previewImage ||
    (profile.profile_picture
      ? `${API_URL}${profile.profile_picture}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
          `${form.first_name} ${form.last_name}`
        )}&background=dc2626&color=ffffff&size=200`);

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <MainLayout>

      <div className="max-w-4xl mx-auto space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-md p-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                ⚙️ Account Settings
              </h1>

              <p className="text-gray-500 mt-1">
                Manage your RiseTogether profile.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/profile")
              }
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition"
            >
              ← Profile
            </button>

          </div>

        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {message && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-xl">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* =================================================
            PROFILE PHOTO
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-md p-6">

          <h2 className="text-xl font-bold text-gray-800">
            Profile Picture
          </h2>

          <p className="text-gray-500 text-sm mt-1">
            Upload a professional photo so people
            can recognize you.
          </p>

          <div className="mt-6 flex flex-col md:flex-row items-center gap-6">

            {/* IMAGE */}

            <img
              src={profileImage}
              alt={`${profile.first_name} ${profile.last_name}`}
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-md"
            />

            {/* CONTROLS */}

            <div className="flex-1">

              <label
                htmlFor="profilePhoto"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Choose a new picture
              </label>

              <input
                id="profilePhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
              />

              <p className="text-xs text-gray-500 mt-2">
                JPG, PNG, WEBP or GIF. Maximum size:
                5MB.
              </p>

              {selectedPhoto && (
                <button
                  type="button"
                  onClick={uploadProfilePhoto}
                  disabled={uploadingPhoto}
                  className="mt-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-5 py-2 rounded-lg font-semibold transition"
                >
                  {uploadingPhoto
                    ? "Uploading..."
                    : "Upload Picture"}
                </button>
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            PROFILE PREVIEW
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-md p-6">

          <h2 className="text-xl font-bold mb-5">
            Profile Preview
          </h2>

          <div className="flex items-center gap-4">

            <img
              src={profileImage}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
            />

            <div>

              <h3 className="text-xl font-bold text-gray-800">
                {form.first_name}{" "}
                {form.last_name}
              </h3>

              <p className="text-gray-500">
                {profile.email}
              </p>

              {form.university && (
                <p className="text-sm text-gray-500 mt-1">
                  🎓 {form.university}
                </p>
              )}

              {form.course && (
                <p className="text-sm text-gray-500">
                  📚 {form.course}
                </p>
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            EDIT PROFILE
        ================================================= */}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md p-6"
        >

          <h2 className="text-xl font-bold mb-6">
            Personal Information
          </h2>

          {/* FIRST + LAST NAME */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>

              <label
                htmlFor="first_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                First Name
              </label>

              <input
                id="first_name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

            </div>

            <div>

              <label
                htmlFor="last_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Last Name
              </label>

              <input
                id="last_name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

            </div>

          </div>

          {/* EMAIL */}

          <div className="mt-5">

            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="w-full border border-gray-200 bg-gray-100 text-gray-500 rounded-lg px-4 py-3 cursor-not-allowed"
            />

            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed here.
            </p>

          </div>

          {/* BIO */}

          <div className="mt-5">

            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Bio
            </label>

            <textarea
              id="bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell people something about yourself..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />

          </div>

          {/* UNIVERSITY */}

          <div className="mt-5">

            <label
              htmlFor="university"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              University / College
            </label>

            <input
              id="university"
              name="university"
              type="text"
              value={form.university}
              onChange={handleChange}
              placeholder="e.g. Multimedia University of Kenya"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

          </div>

          {/* COURSE */}

          <div className="mt-5">

            <label
              htmlFor="course"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Course / Program
            </label>

            <input
              id="course"
              name="course"
              type="text"
              value={form.course}
              onChange={handleChange}
              placeholder="e.g. Cyber Security and Computer Forensics"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

          </div>

          {/* YEAR */}

          <div className="mt-5">

            <label
              htmlFor="year_of_study"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Year of Study
            </label>

            <select
              id="year_of_study"
              name="year_of_study"
              value={form.year_of_study}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >

              <option value="">
                Select year
              </option>

              <option value="Year 1">
                Year 1
              </option>

              <option value="Year 2">
                Year 2
              </option>

              <option value="Year 3">
                Year 3
              </option>

              <option value="Year 4">
                Year 4
              </option>

              <option value="Year 5">
                Year 5
              </option>

            </select>

          </div>

          {/* =================================================
              SAVE / CANCEL
          ================================================= */}

          <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">

            <button
              type="button"
              onClick={() =>
                navigate("/profile")
              }
              className="px-5 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold transition"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </form>

        {/* =================================================
            ACCOUNT
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-md p-6">

          <h2 className="text-xl font-bold text-gray-800">
            Account
          </h2>

          <p className="text-gray-500 text-sm mt-1">
            Manage your RiseTogether account.
          </p>

          <button
            type="button"
            onClick={logout}
            className="mt-5 bg-red-100 hover:bg-red-200 text-red-700 px-5 py-3 rounded-lg font-semibold transition"
          >
            🚪 Logout
          </button>

        </div>

      </div>

    </MainLayout>
  );
}

export default Settings;