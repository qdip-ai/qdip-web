import { ArrowUpRight } from 'lucide-react'
import styles from './plugin-experience.module.css'

type PluginLaunchLinkProps = {
  href: string
  label: string
}

/** One consistent, accessible external-app action for plugin cards and details. */
export function PluginLaunchLink({ href, label }: PluginLaunchLinkProps) {
  return (
    <a className={styles.primaryLink} href={href} target="_blank" rel="noopener noreferrer">
      <span>{label}</span>
      <ArrowUpRight size={17} strokeWidth={1.9} aria-hidden="true" />
    </a>
  )
}
