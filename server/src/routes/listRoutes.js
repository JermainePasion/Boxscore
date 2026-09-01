import express from "express"
import {
  getMyLists,
  getListsByUser,
  getExploreLists,
  getListById,
  createList,
  saveList,
  deleteList,
} from "../controllers/listController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/me", authenticate, getMyLists)
router.get("/explore", getExploreLists)
router.get("/user/:username", getListsByUser)

router.post("/", authenticate, createList)
router.put("/:id", authenticate, saveList)
router.delete("/:id", authenticate, deleteList)

router.get("/:id", getListById)

export default router