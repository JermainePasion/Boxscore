import { BrowserRouter, Routes, Route } from "react-router-dom"
import DashboardLayout from "./layouts/DashboardLayout"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/games" element={<div>Games page</div>} />
          <Route path="/feed" element={<div>Feed page</div>} />
          <Route path="/pyramid" element={<div>Pyramid page</div>} />
        </Route>
        {/* Login/Register outside the layout (no navbar) */}
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App