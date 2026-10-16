import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
}

function EditProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    university: "",
    course: "",
    year_of_study: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<Profile>("/users/me");

      const user = response.data;

      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        bio: user.bio || "",
        university: user.university || "",
        course: user.course || "",
        year_of_study: user.year_of_study || "",
      });
    } catch (error) {
      console.error("Failed to load profile:", error);
      setError("Failed to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.put("/users/me", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        bio: form.bio.trim(),
        university: form.university.trim(),
        course: form.course.trim(),
        year_of_study: form.year_of_study.trim(),
      });

      setSuccess("Profile updated successfully.");

      setTimeout(() => {
        navigate("/profile");
      }, 1000);
    } catch (error: any) {
      console.error("Failed to update profile:", error);

      setError(
        error.response?.data?.detail ||
          "Failed to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          Loading profile...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="bg-white rounded-xl shadow-md overflow-hidden">

        {/* HEADER */}

        <div className="bg-gradient-to-r from-red-600 to-red-400 px-6 py-8 text-white">

          <h1 className="text-2xl font-bold">
            Edit Profile
          </h1>

          <p className="mt-1 text-red-100">
            Update your RiseTogether profile information.
          </p>

        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6"
        >

          {/* SUCCESS */}

          {success && (
            <div className="bg-green-100 border border-green-300 text-green-700 rounded-lg p-4">
              {success}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg p-4">
              {error}
            </div>
          )}

          {/* NAME */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First Name
              </label>

              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Last Name
              </label>

              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

          </div>

          {/* BIO */}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bio
            </label>

            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell people something about yourself..."
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* UNIVERSITY */}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              University
            </label>

            <input
              type="text"
              name="university"
              value={form.university}
              onChange={handleChange}
              placeholder="e.g. Multimedia University of Kenya"
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* COURSE */}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Course
            </label>

            <input
              type="text"
              name="course"
              value={form.course}
              onChange={handleChange}
              placeholder="e.g. Cyber Security and Computer Forensics"
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* YEAR */}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Year of Study
            </label>

            <input
              type="text"
              name="year_of_study"
              value={form.year_of_study}
              onChange={handleChange}
              placeholder="e.g. Year 1"
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* BUTTONS */}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">

            <button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold"
            >
              Cancel
            </button>

          </div>

        </form>

      </div>
    </MainLayout>
  );
}

export default EditProfile;