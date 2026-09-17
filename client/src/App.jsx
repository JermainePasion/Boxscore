import { BrowserRouter, Routes, Route } from "react-router-dom"
import DashboardLayout from "./layouts/DashboardLayout"
import Home from "./screens/Home"
import GameDetail from "./screens/GameDetail"
import SearchPage from "./screens/SearchPage"
import Games from "./screens/Games"
import Pyramid from "./screens/Pyramid"
import PyramidEditor from "./screens/PyramidEditor"
import PyramidDetail from "./screens/PyramidDetail"
import Profile from "./screens/Profile"
import MyProfile from "./screens/MyProfile"
import Diary from "./screens/Diary"
import Watchlist from "./screens/Watchlist"
import Lists from "./screens/lists/Lists"
import ListEditor from "./screens/lists/ListEditor"
import ListDetail from "./screens/lists/ListDetail"
import Matchup from "./screens/Matchup"

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
          <Route path="/pyramid/edit" element={<PyramidEditor />} />
          <Route path="/pyramid/:id" element={<PyramidDetail />} />

          <Route path="/lists" element={<Lists />} />
          <Route path="/lists/edit" element={<ListEditor />} />
          <Route path="/lists/:id" element={<ListDetail />} />

          <Route path="/matchup" element={<Matchup />} />
          <Route path="/matchup/:aId/:bId" element={<Matchup />} />

          <Route path="/search" element={<SearchPage />} />

          <Route path="/profile" element={<MyProfile />} />
          <Route path="/user/:username" element={<Profile />} />
          <Route path="/user/:username/diary" element={<Diary />} />

          <Route path="/watchlist" element={<Watchlist />} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App