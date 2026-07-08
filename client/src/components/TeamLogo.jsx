import { teamLogo } from "../utils/teamColors"

export default function TeamLogoImg({ teamId, alt = "", className }) {
  return (
    <img
      src={teamLogo(teamId)}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={e => { e.target.style.visibility = "hidden" }}
    />
  )
}