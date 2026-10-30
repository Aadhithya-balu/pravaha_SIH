path = r'frontend/src/components/AlertsTab.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old_block = """  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const filteredAlerts = alerts.filter((al) => {
    if (unreadOnly && al.is_read) return false;
    if (severityFilter !== 'ALL' && al.severity !== severityFilter) return false;
    return true;
  });

  async function handleMarkRead(aid: number) {
    setMarkingId(aid);
    try {
      await markNotificationRead(aid);
      // Strictly update the alert read status in place without triggering an auth profile reload
      const targetAlert = alerts.find((a) => a.id === aid);
      if (targetAlert) {
        targetAlert.is_read = true;
      }
    } catch (err: any) {
      console.error('Failed to mark alert as read:', err);
    } finally {
      setMarkingId(null);
    }
  }"""

new_block = """  const [localAlerts, setLocalAlerts] = useState<AlertItem[]>(alerts);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [markingId, setMarkingId] = useState<number | null>(null);

  React.useEffect(() => {
    setLocalAlerts(alerts);
  }, [alerts]);

  const filteredAlerts = localAlerts.filter((al) => {
    if (unreadOnly && al.is_read) return false;
    if (severityFilter !== 'ALL' && al.severity !== severityFilter) return false;
    return true;
  });

  async function handleMarkRead(aid: number) {
    setMarkingId(aid);
    try {
      await markNotificationRead(aid);
      setLocalAlerts((prev) => prev.map((a) => (a.id === aid ? { ...a, is_read: true } : a)));
    } catch (err: any) {
      console.error('Failed to mark alert as read:', err);
    } finally {
      setMarkingId(null);
    }
  }"""

if old_block in text:
    text = text.replace(old_block, new_block)
else:
    text = text.replace(old_block.replace('\r\n', '\n'), new_block.replace('\r\n', '\n'))

# Also update unreadCount
text = text.replace(
    'const unreadCount = alerts.filter((a) => !a.is_read).length;',
    'const unreadCount = localAlerts.filter((a) => !a.is_read).length;'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated AlertsTab.tsx successfully!")

