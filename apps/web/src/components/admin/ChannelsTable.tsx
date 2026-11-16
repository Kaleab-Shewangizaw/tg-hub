import Link from 'next/link';
import { channelAction } from '@/app/actions/admin';
import type { AdminChannelRow } from '@/server/repo';
import { ChannelStatusChip } from '../ChannelStatus';
import { ConfirmSubmit } from './AdminForms';
import { ago, fmt } from './format';

export function ChannelsTable({ channels, showOwner = true, empty }: { channels: AdminChannelRow[]; showOwner?: boolean; empty: string }) {
  if (channels.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th scope="col">Channel</th>
            {showOwner ? <th scope="col">Owner</th> : null}
            <th scope="col">Status</th>
            <th scope="col" className="num">
              Posts
            </th>
            <th scope="col" className="num">
              Stars
            </th>
            <th scope="col">Last post</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="adm-who">
                  <strong>{c.title}</strong>
                  <span className="faint small">
                    {c.handle ? `@${c.handle}` : c.externalId} · {c.platform}
                    {c.source !== 'live' ? ` · ${c.source}` : ''}
                  </span>
                </span>
              </td>
              {showOwner ? (
                <td>
                  {c.userId ? (
                    <Link href={`/admin/users/${c.userId}`} className="adm-link">
                      {c.ownerName}
                    </Link>
                  ) : (
                    <span className="chip chip-outline">Unclaimed</span>
                  )}
                </td>
              ) : null}
              <td>
                <ChannelStatusChip status={c.status} />
              </td>
              <td className="num mono">{fmt(c.posts)}</td>
              <td className="num mono">{fmt(c.stars)}</td>
              <td className="mono small">{ago(c.lastPostAt)}</td>
              <td>
                <div className="adm-row-actions">
                  {c.userId ? (
                    <form action={channelAction}>
                      <input type="hidden" name="channelId" value={c.id} />
                      <input type="hidden" name="intent" value="release" />
                      <ConfirmSubmit message={`Detach “${c.title}” from ${c.ownerName}? It keeps its posts and can be claimed again.`} className="btn btn-sm btn-ghost">
                        Release
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                  <form action={channelAction}>
                    <input type="hidden" name="channelId" value={c.id} />
                    <input type="hidden" name="intent" value="delete" />
                    <ConfirmSubmit message={`Delete “${c.title}” and all ${c.posts} of its posts? This can’t be undone.`} className="btn btn-sm btn-ghost btn-warn">
                      Delete
                    </ConfirmSubmit>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
