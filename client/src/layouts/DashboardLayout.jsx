import { Outlet } from "react-router-dom"
import Navbar from "../components/Layout/Navbar"

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <Navbar />

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}