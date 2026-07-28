import MainLayout from "../layout/MainLayout";

function Dashboard() {
  return (
    <MainLayout>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold">
          Welcome to RiseTogether 🎉
        </h2>

        <p className="mt-4 text-gray-600">
          Start by creating your first post.
        </p>

        <textarea
          className="w-full mt-6 border rounded-lg p-3"
          rows={4}
          placeholder="What's on your mind?"
        />

        <button className="mt-4 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700">
          Post
        </button>
      </div>
    </MainLayout>
  );
}

export default Dashboard;