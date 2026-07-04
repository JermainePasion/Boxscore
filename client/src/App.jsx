import { BrowserRouter, Routes, Route } from "react-router-dom"
import DashboardLayout from "./layouts/DashboardLayout"
import Home from "./screens/Home"
import GameDetail from "./screens/GameDetail"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home/>} />
          <Route path="/games" element={<div>Games page</div>} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/feed" element={<div>Feed page</div>} />
          <Route path="/pyramid" element={<div>Pyramid page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App