import type { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <header className="bg-red-600 text-white px-6 py-4 shadow-md">
        <h1 className="text-2xl font-bold">RiseTogether</h1>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-4 p-4">
        {/* Left Sidebar */}
        <aside className="col-span-2 bg-white rounded-lg shadow p-4">
          <ul className="space-y-3">
            <li>🏠 Home</li>
            <li>👤 Profile</li>
            <li>💬 Messages</li>
            <li>🔔 Notifications</li>
            <li>⚙ Settings</li>
          </ul>
        </aside>

        {/* Main Feed */}
        <main className="col-span-7">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="col-span-3 bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-lg">Suggestions</h2>

          <div className="mt-4">
            <p>👤 Alice</p>
            <p>👤 Brian</p>
            <p>👤 Cynthia</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default MainLayout;