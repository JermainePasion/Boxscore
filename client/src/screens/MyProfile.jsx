import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function MyProfile() {
  const { user, isAuthed } = useAuth()
  if (!isAuthed) return <Navigate to="/" replace />
  return <Navigate to={`/user/${user.username}`} replace />
}