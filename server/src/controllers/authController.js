import { prisma } from "../../lib/prisma.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET 

export const register = async (req, res) => {
    const {username, email, password} = req.body

    try{
        const existingUser =  await prisma.user.findFirst({
            where:{
                OR: [{username}, {email}]
            }
        })
        if(existingUser){
            return res.status(400).json({error: "User already exists."})
        }
        const hashedPassword = await bcrypt.hash(password, 15)

        const user =  await prisma.user.create({
            data: {
                username,
                email,
                passwordHash: hashedPassword
            }
        })
        res.json(user)
    }catch (err){
        console.error(err)
        res.status(500).json({error: "Register failed."})
    }
}

export const login = async (req, res) => {
    const {email, password} = req.body

    try{
        const user = await prisma.user.findUnique({
            where:{ email }
        })

        if (!user){
            return res.status(400).json({error: "Invalid input"})
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)

        if(!isMatch){
            return res.status(400).json({error: "Invalid input"})
        }

        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: "7d" }
        )
        res.json(user)
        }catch (err){
        console.error(err)
        res.status(500).json({error: "Register failed."})
    }
}

export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hashedPassword
      }
    })

    res.json({ message: "Password updated" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Reset failed" })
  }
}