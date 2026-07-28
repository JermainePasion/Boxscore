import { prisma } from "../../lib/prisma.js"

export const toggleFollow = async (req, res) => {
  const followerId = req.user?.userId
  if (!followerId) return res.status(401).json({ error: "Unauthorized" })

  const { userId: followingId } = req.params

  if (followerId === followingId) {
    return res.status(400).json({ error: "Cannot follow yourself" })
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: followingId } })
    if (!target) return res.status(404).json({ error: "User not found" })

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    })

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } }
      })
      return res.json({ following: false })
    } else {
      await prisma.follow.create({ data: { followerId, followingId } })
      return res.json({ following: true })
    }
  } catch (err) {
    console.error("toggleFollow error:", err)
    return res.status(500).json({ error: "Failed to toggle follow" })
  }
}

export const getFollowers = async (req, res) => {
  const { username } = req.params

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const followers = await prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        follower: {
          select: { id: true, username: true, avatarUrl: true, bio: true }
        }
      }
    })

    return res.json(followers.map(f => f.follower))
  } catch (err) {
    console.error("getFollowers error:", err)
    return res.status(500).json({ error: "Failed to fetch followers" })
  }
}


export const getFollowing = async (req, res) => {
  const { username } = req.params

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        following: {
          select: { id: true, username: true, avatarUrl: true, bio: true }
        }
      }
    })

    return res.json(following.map(f => f.following))
  } catch (err) {
    console.error("getFollowing error:", err)
    return res.status(500).json({ error: "Failed to fetch following" })
  }
}

export const followUser = async (req, res) => {
  const followerId = req.user?.userId
  if (!followerId) return res.status(401).json({ error: "Unauthorized" })

  const { username } = req.params

  try {
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (!target) return res.status(404).json({ error: "User not found" })

    if (target.id === followerId) {
      return res.status(400).json({ error: "You can't follow yourself" })
    }

    await prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId: target.id }
      },
      create: { followerId, followingId: target.id },
      update: {}
    })

    return res.status(201).json({ following: true })
  } catch (err) {
    console.error("followUser error:", err)
    return res.status(500).json({ error: "Failed to follow user" })
  }
}

export const unfollowUser = async (req, res) => {
  const followerId = req.user?.userId
  if (!followerId) return res.status(401).json({ error: "Unauthorized" })

  const { username } = req.params

  try {
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (!target) return res.status(404).json({ error: "User not found" })

    await prisma.follow.deleteMany({
      where: { followerId, followingId: target.id }
    })

    return res.json({ following: false })
  } catch (err) {
    console.error("unfollowUser error:", err)
    return res.status(500).json({ error: "Failed to unfollow user" })
  }
}