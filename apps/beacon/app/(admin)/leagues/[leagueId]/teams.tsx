import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '../../../../components/admin/AdminShell';
import { AdminButton } from '../../../../components/admin/AdminButton';
import { AdminChip } from '../../../../components/admin/AdminChip';
import { AdminTallyRow } from '../../../../components/admin/AdminTally';
import { Diamond } from '../../../../components/Diamond';
import { PasswordConfirmPanel } from '../../../../components/admin/PasswordConfirmPanel';
import { Spinner } from '../../../../components/Spinner';
import { color, fontFamily, tabularNums } from '../../../../theme/tokens';
import { formatDateTime } from '../../../../lib/time';
import { useSession } from '../../../../lib/hooks/useSession';
import { useAdminLeague } from '../../../../lib/api/adminLeagues';
import { ApprovalTeam, useApprovalQueue, useDecideTeam, useRemoveTeamFromLeague } from '../../../../lib/api/adminApprovals';

// Reference: Beacon 12 Approve Teams.dc.html. The source shows captain
// "email · phone" contact — Beacon never collects a phone number and the
// only email on file is the Supabase Auth address, which isn't queryable
// client-side. This shows the captain's roster entry instead (name + EA
// ID), which is the contact info the admin actually has.
const REASONS = ['Unverified EA ID', 'Roster below minimum', 'Rank outside division', 'Duplicate registration'];
const FILTERS = ['Pending', 'Approved', 'Rejected', 'All'] as const;

export default function ApproveTeams() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { userId } = useSession();
  const { data: league } = useAdminLeague(leagueId);
  const { data: queue, isLoading } = useApprovalQueue(leagueId);
  const decide = useDecideTeam(leagueId, userId);
  const removeTeam = useRemoveTeamFromLeague(leagueId);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasonByTeam, setReasonByTeam] = useState<Record<string, string>>({});
  const [noteByTeam, setNoteByTeam] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const teamsPerLobby = league?.teams_per_lobby ?? 20;
  const approvedCount = (queue ?? []).filter((t) => t.status === 'approved').length;
  const pendingCount = (queue ?? []).filter((t) => t.status === 'pending').length;
  const rejectedCount = (queue ?? []).filter((t) => t.status === 'rejected').length;
  const openSlots = Math.max(0, teamsPerLobby - approvedCount);

  const visible = (queue ?? []).filter((t) => filter === 'All' || t.status === filter.toLowerCase());

  async function approve(team: ApprovalTeam) {
    if (team.verifiedCount < 3) return;
    await decide.mutateAsync({ teamId: team.teamId, decision: 'approved' });
  }

  async function confirmReject(team: ApprovalTeam) {
    const reason = reasonByTeam[team.teamId];
    if (!reason) return;
    const note = noteByTeam[team.teamId]?.trim();
    await decide.mutateAsync({ teamId: team.teamId, decision: 'rejected', reason: note ? `${reason}: ${note}` : reason });
    setRejectingId(null);
  }

  async function undo(team: ApprovalTeam) {
    await decide.mutateAsync({ teamId: team.teamId, decision: 'pending' });
  }

  async function confirmRemove(team: ApprovalTeam) {
    await removeTeam.mutateAsync(team.teamId);
    setRemovingId(null);
  }

  return (
    <AdminShell
      active="approvals"
      activeLeagueId={leagueId}
      breadcrumbs={[
        { label: 'Leagues', href: '/(admin)/leagues' },
        { label: league?.name ?? 'League', href: `/(admin)/leagues/create?leagueId=${leagueId}` as any },
        { label: 'Team approvals' },
      ]}
      title="TEAM APPROVALS"
      actions={
        <AdminTallyRow
          items={[
            { n: approvedCount, label: 'APPROVED', fg: color.verified },
            { n: pendingCount, label: 'PENDING' },
            { n: rejectedCount, label: 'REJECTED', fg: color.textMuted },
            { n: openSlots, label: 'SLOTS OPEN', fg: color.textMuted },
          ]}
        />
      }
      rail={
        <>
          <Text style={styles.railTitle}>League fill</Text>
          <View style={styles.fillCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={[styles.fillCount, tabularNums]}>{approvedCount}</Text>
              <Text style={styles.fillOf}>of {teamsPerLobby} approved</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: teamsPerLobby }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    backgroundColor: i < approvedCount ? color.verified : i < approvedCount + pendingCount ? 'rgba(242,241,236,0.45)' : 'rgba(242,241,236,0.14)',
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <LegendDot color={color.verified} label="Approved" />
              <LegendDot color="rgba(242,241,236,0.45)" label="Pending" />
              <LegendDot color="rgba(242,241,236,0.14)" label="Open" />
            </View>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>VERIFICATION RULES</Text>
            <View style={{ gap: 9 }}>
              <RuleRow>
                <Text style={{ color: color.textPrimary }}>Verified</Text> — EA account linked and rank read directly.
              </RuleRow>
              <RuleRow>
                <Text style={{ color: color.textPrimary }}>Unverified</Text> — ID entered but no EA handshake. Cannot count toward the minimum three.
              </RuleRow>
            </View>
            <Text style={styles.ruleFooter}>
              A team needs three verified players to be approvable. Approving anyway is not possible — that's what keeps the standings trustworthy.
            </Text>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>REGISTRATION WINDOW</Text>
            <Text style={styles.windowBody}>
              {league?.season_start ? `Season starts ${league.season_start}. ` : ''}Rejected teams can fix their roster and re-register at any time before the league fills.
            </Text>
          </View>
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable key={f} onPress={() => { setFilter(f); setRejectingId(null); }}>
              <View style={[styles.filterChip, filter === f ? { backgroundColor: color.textPrimary, borderColor: color.textPrimary } : { borderColor: color.hairlineInput }]}>
                <Text style={[styles.filterChipLabel, filter === f && { color: color.base }]}>{f}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.capacityLine}>
          {approvedCount} of {teamsPerLobby} slots filled
        </Text>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <Spinner size={20} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{filter === 'Pending' ? 'Queue clear' : `Nothing ${filter.toLowerCase()}`}</Text>
          <Text style={styles.emptyBody}>
            {filter === 'Pending'
              ? 'Every registration has been decided. New ones will appear here as teams register.'
              : 'No teams in this state yet. Switch to Pending to work the queue.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {visible.map((team) => (
            <TeamCard
              key={team.teamId}
              team={team}
              region={league?.region ?? 'Ireland-wide'}
              rejecting={rejectingId === team.teamId}
              reason={reasonByTeam[team.teamId]}
              note={noteByTeam[team.teamId] ?? ''}
              busy={decide.isPending}
              onApprove={() => approve(team)}
              onStartReject={() => setRejectingId(team.teamId)}
              onCancelReject={() => setRejectingId(null)}
              onPickReason={(r) => setReasonByTeam((s) => ({ ...s, [team.teamId]: r }))}
              onNote={(v) => setNoteByTeam((s) => ({ ...s, [team.teamId]: v }))}
              onConfirmReject={() => confirmReject(team)}
              onUndo={() => undo(team)}
              removing={removingId === team.teamId}
              onStartRemove={() => setRemovingId(team.teamId)}
              onCancelRemove={() => setRemovingId(null)}
              onConfirmRemove={() => confirmRemove(team)}
            />
          ))}
        </View>
      )}
    </AdminShell>
  );
}

function TeamCard({
  team,
  region,
  rejecting,
  reason,
  note,
  busy,
  onApprove,
  onStartReject,
  onCancelReject,
  onPickReason,
  onNote,
  onConfirmReject,
  onUndo,
  removing,
  onStartRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  team: ApprovalTeam;
  region: string;
  rejecting: boolean;
  reason: string | undefined;
  note: string;
  busy: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onPickReason: (r: string) => void;
  onNote: (v: string) => void;
  onConfirmReject: () => void;
  onUndo: () => void;
  removing: boolean;
  onStartRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => Promise<void> | void;
}) {
  const approvable = team.verifiedCount >= 3;
  const unverified = team.roster.filter((p) => !p.verified);
  const borderColor = team.status === 'approved' ? color.verifiedBorderStrong : team.status === 'rejected' ? color.emberBorderStrong : color.hairline;
  const chipTone = team.status === 'approved' ? 'verified' : team.status === 'rejected' ? 'ember' : 'neutral';

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={styles.teamName}>{team.name}</Text>
            <AdminChip label={team.status.toUpperCase()} tone={chipTone as any} />
          </View>
          <Text style={[styles.teamMeta, tabularNums]}>
            Registered {formatDateTime(team.registeredAt)} · {team.roster.length} players · {region}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <Text style={styles.captainLabel}>CAPTAIN</Text>
          <Text style={styles.captainName}>{team.captainName}</Text>
        </View>
      </View>

      <View style={styles.rosterTable}>
        <View style={styles.rosterHeaderRow}>
          <Text style={[styles.rosterHeaderCell, { flex: 1.1 }]}>PLAYER</Text>
          <Text style={[styles.rosterHeaderCell, { flex: 1.4 }]}>LINKED EA / APEX ID</Text>
          <Text style={[styles.rosterHeaderCell, { width: 108 }]}>RANK</Text>
          <Text style={[styles.rosterHeaderCell, { width: 92, textAlign: 'right' }]}>STATUS</Text>
        </View>
        {team.roster.map((p) => (
          <View key={p.profileId} style={styles.rosterRow}>
            <View style={{ flex: 1.1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <View style={styles.initialsBox}>
                <Text style={styles.initialsText}>{initialsOf(p.name)}</Text>
              </View>
              <View style={{ gap: 2, minWidth: 0 }}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerRole}>{p.role === 'captain' ? 'Captain' : p.role === 'sub' ? 'Sub' : 'Member'}</Text>
              </View>
            </View>
            <Text style={[styles.rosterCell, { flex: 1.4, color: p.verified ? color.textPrimary : color.textMuted }, tabularNums]} numberOfLines={1}>
              {p.eaId ?? 'Not linked'}
            </Text>
            <Text style={[styles.rosterCell, { width: 108, color: color.textMuted }, tabularNums]}>{p.rank ?? '—'}</Text>
            <View style={{ width: 92, alignItems: 'flex-end' }}>
              <AdminChip label={p.verified ? 'VERIFIED' : 'UNVERIFIED'} tone={p.verified ? 'verified' : 'neutral'} dotShape="diamond" />
            </View>
          </View>
        ))}
      </View>

      {team.status === 'pending' && unverified.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
          <View style={styles.flagBar} />
          <Text style={styles.flagText}>
            {unverified.length === team.roster.length
              ? 'No player on this roster has completed the EA handshake yet.'
              : `${unverified.map((p) => p.name).join(', ')} ${unverified.length === 1 ? 'has' : 'have'} not completed the EA handshake — rank can't be read yet.`}
          </Text>
        </View>
      )}

      {team.status === 'pending' ? (
        rejecting ? (
          <View style={styles.rejectPanel}>
            <Text style={styles.rejectLabel}>REASON FOR REJECTION · SENT TO THE CAPTAIN</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {REASONS.map((r) => (
                <Pressable key={r} onPress={() => onPickReason(r)}>
                  <View style={[styles.reasonChip, reason === r ? { backgroundColor: color.ember, borderColor: color.ember } : { borderColor: color.hairlineInput }]}>
                    <Text style={[styles.reasonChipLabel, reason === r && { color: color.base }]}>{r}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={onNote}
              placeholder="Add detail the captain can act on…"
              placeholderTextColor={color.fillPlaceholder}
              multiline
              style={styles.noteInput}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdminButton
                label={reason ? 'Send rejection' : 'Pick a reason first'}
                variant="destructiveFilled"
                disabled={!reason || busy}
                onPress={onConfirmReject}
              />
              <Pressable onPress={onCancelReject}>
                <View style={{ height: 42, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.idleRow}>
            <AdminButton label="Approve team" height={44} disabled={!approvable || busy} onPress={onApprove} />
            <AdminButton label="Reject" variant="destructiveOutline" height={44} disabled={busy} onPress={onStartReject} />
            <Text style={styles.actionNote}>
              {approvable
                ? `${team.verifiedCount} of ${team.roster.length} players verified. Approving adds the team to the standings immediately.`
                : `Needs 3 verified players to approve — this roster has ${team.verifiedCount}. Reject with a reason so the captain can fix it.`}
            </Text>
          </View>
        )
      ) : removing ? (
        <PasswordConfirmPanel
          label="REMOVE THIS TEAM FROM THE LEAGUE"
          warning={`This unregisters ${team.name} from this league and deletes their results, lineups, and substitutions for every game in it. Their roster and any other leagues they're in are untouched. This can't be undone.`}
          confirmLabel="Remove team"
          onCancel={onCancelRemove}
          onConfirmed={onConfirmRemove}
        />
      ) : (
        <View style={styles.resolvedRow}>
          <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', flex: 1 }}>
            {team.status === 'approved' && <Diamond size={9} color={color.verified} style={{ marginTop: 4 }} />}
            <Text style={[styles.resolvedText, { color: team.status === 'approved' ? color.verified : color.ember }]}>
              {team.status === 'approved'
                ? 'Approved. The team appears in the standings and can be scheduled from today.'
                : `Rejected — ${team.rejectionReason ?? 'reason recorded'}. The captain has been notified and can re-register.`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {team.status === 'approved' && (
              <Pressable onPress={onStartRemove} disabled={busy}>
                <Text style={styles.removeLabel}>Remove from league</Text>
              </Pressable>
            )}
            <Pressable onPress={onUndo} disabled={busy}>
              <Text style={styles.undoLabel}>Undo</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color: c, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 6, backgroundColor: c }} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function RuleRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
      <View style={{ width: 8, height: 8, marginTop: 5, borderWidth: 1, borderColor: color.textMuted }} />
      <Text style={styles.ruleBody}>{children}</Text>
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—';
}

const styles = StyleSheet.create({
  filterChip: { paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1 },
  filterChipLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  capacityLine: { fontFamily: fontFamily.interRegular, fontSize: 11, color: color.textMuted, ...tabularNums },
  emptyBox: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 32, gap: 12, alignItems: 'flex-start' },
  emptyTitle: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, color: color.textPrimary },
  emptyBody: { fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, color: color.textMuted, maxWidth: 460 },
  card: { borderWidth: 1, backgroundColor: color.panel, padding: 22, gap: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 },
  teamName: { fontFamily: fontFamily.rajdhaniBold, fontSize: 22, letterSpacing: 0.01 * 22, color: color.textPrimary },
  teamMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 16, color: color.textMuted },
  captainLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  captainName: { fontFamily: fontFamily.interMedium, fontSize: 12, color: color.textPrimary },
  rosterTable: { borderTopWidth: 1, borderTopColor: color.hairline },
  rosterHeaderRow: { flexDirection: 'row', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.08)' },
  rosterHeaderCell: { fontFamily: fontFamily.interSemiBold, fontSize: 9, letterSpacing: 0.12 * 9, color: color.textMuted },
  rosterRow: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(242,241,236,0.06)' },
  initialsBox: { width: 26, height: 26, borderWidth: 1, borderColor: color.neutralBorder, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fontFamily.rajdhaniBold, fontSize: 10, color: color.textMuted },
  playerName: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: color.textPrimary },
  playerRole: { fontFamily: fontFamily.interRegular, fontSize: 10, color: color.textMuted },
  rosterCell: { fontFamily: fontFamily.interMedium, fontSize: 12 },
  flagBar: { width: 3, alignSelf: 'stretch', backgroundColor: 'rgba(242,241,236,0.35)' },
  flagText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  idleRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16, flexWrap: 'wrap' },
  actionNote: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted, flex: 1, minWidth: 160 },
  rejectPanel: { gap: 11, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16 },
  rejectLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  reasonChip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  reasonChipLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: color.textMuted },
  noteInput: { minHeight: 74, backgroundColor: color.base, borderWidth: 1, borderColor: color.hairlineInput, color: color.textPrimary, fontFamily: fontFamily.interRegular, fontSize: 13, lineHeight: 19, padding: 12, textAlignVertical: 'top' },
  cancelLabel: { fontFamily: fontFamily.interMedium, fontSize: 13, color: color.textMuted },
  resolvedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 16 },
  resolvedText: { fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 17 },
  undoLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.textMuted },
  removeLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 12, color: color.ember },
  railTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.16 * 10, textTransform: 'uppercase', color: color.textMuted },
  fillCard: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 20, gap: 14 },
  fillCount: { fontFamily: fontFamily.rajdhaniBold, fontSize: 34, color: color.textPrimary },
  fillOf: { fontFamily: fontFamily.interRegular, fontSize: 12, color: color.textMuted, ...tabularNums },
  legendLabel: { fontFamily: fontFamily.interRegular, fontSize: 11, lineHeight: 15, color: color.textMuted },
  ruleCard: { borderWidth: 1, borderColor: color.hairline, backgroundColor: color.panel, padding: 18, gap: 11 },
  ruleTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 10, letterSpacing: 0.14 * 10, color: color.textMuted },
  ruleBody: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted },
  ruleFooter: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 17, color: color.textMuted, borderTopWidth: 1, borderTopColor: color.hairline, paddingTop: 11 },
  windowBody: { fontFamily: fontFamily.interRegular, fontSize: 12, lineHeight: 18, color: color.textMuted, ...tabularNums },
});
