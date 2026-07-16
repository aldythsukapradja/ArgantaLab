/**
 * CONTENT BUILDER — one surface, one source of truth: the Post Studio. Arganta
 * Core writes drafts into the Drafts inbox; the operator reviews the composed
 * canvas and clicks "Approve & publish everywhere" to fan out to every
 * destination (Kinetik moments, Buffer → Instagram). The old seven-tab
 * Autopilot/Catalogue toolset has been retired — this is now the only automated
 * social-posting path.
 */
import { PostStudio } from './broadcast/PostStudio'
import './broadcast/post.css'

export function Broadcast() {
  return <PostStudio />
}
