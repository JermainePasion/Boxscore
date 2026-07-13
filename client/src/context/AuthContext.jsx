import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  // restore session on mount
  useEffect(() => {
    const t = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (t && u) {
      setToken(t)
      try { setUser(JSON.parse(u)) } catch { /* corrupt — ignore */ }
    }
  }, [])

  const login = (token, user) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)