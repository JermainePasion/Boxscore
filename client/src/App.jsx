import { BrowserRouter, Routes, Route } from "react-router-dom"
import DashboardLayout from "./layouts/DashboardLayout"
import Home from "./screens/Home"
import GameDetail from "./screens/GameDetail"
import SearchPage from "./screens/SearchPage"
import Games from "./screens/Games"
import Pyramid from "./screens/Pyramid"
import Profile from "./screens/Profile"
import MyProfile from "./screens/MyProfile"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home/>} />
          <Route path="/games" element={<Games/>} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/feed" element={<div>Feed page</div>} />
          <Route path="/pyramid" element={<Pyramid />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/user/:username" element={<Profile />} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App