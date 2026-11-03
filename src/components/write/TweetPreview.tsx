import type { TweetPart, XAccount } from '../../types'
import './TweetPreview.css'

interface Props {
  parts: TweetPart[]
  account?: Pick<XAccount, 'name' | 'handle' | 'avatarUrl'> | null
}

export function TweetPreview({ parts, account }: Props) {
  const visible = parts.filter((p) => p.text.trim() || p.media.length)
  const display = visible.length ? visible : [{ id: 'empty', text: 'معاينة منشورك تظهر هنا…', media: [] }]

  return (
    <div className="preview-stack" aria-label="معاينة المنشور">
      {display.map((part, index) => (
        <article key={part.id} className="tweet-preview">
          <img
            className="tweet-avatar"
            src={account?.avatarUrl || 'https://api.dicebear.com/9.x/initials/svg?seed=HD'}
            alt=""
          />
          <div className="tweet-body">
            <div className="tweet-meta">
              <strong>{account?.name || 'هدوء'}</strong>
              <span>@{account?.handle || 'hudu'}</span>
              {index > 0 && <span className="thread-badge">ثريد · {index + 1}</span>}
            </div>
            <p className="tweet-text">{part.text || 'معاينة منشورك تظهر هنا…'}</p>
            {part.media.length > 0 && (
              <div className={`tweet-media count-${Math.min(part.media.length, 4)}`}>
                {part.media.map((m) =>
                  m.type === 'video' || m.type === 'gif' ? (
                    <video key={m.id} src={m.url} controls muted playsInline />
                  ) : (
                    <img key={m.id} src={m.url} alt={m.name} />
                  ),
                )}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
