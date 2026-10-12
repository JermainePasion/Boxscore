import { Outlet } from "react-router-dom"
import Navbar from "../components/Layout/Navbar"
import Footer from "../components/Layout/Footer"

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-primary-dark">
      <Navbar />

      {/* Page content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}