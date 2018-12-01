package backupstatus

type Enum int

const (
	EMPTY Enum = iota
	BACKUPED
	OUTDATED
)
