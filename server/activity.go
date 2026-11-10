package main

import (
	"bytes"
	"encoding/json"
	"os"
	"sync"
)

const (
	maxLogLines = 500
	logRotateAt = maxLogLines * 2
)

type ActivityLog struct {
	Time  string `json:"time"`
	Mode  string `json:"mode"`
	Hari  string `json:"hari"`
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

var (
	logMu    sync.Mutex
	logCount int
)

func splitLogLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if line := data[start:i]; len(line) > 0 {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(data) {
		if line := data[start:]; len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func initLogCount() {
	logMu.Lock()
	defer logMu.Unlock()
	data, err := os.ReadFile(logFile)
	if err != nil {
		logCount = 0
		return
	}
	lines := splitLogLines(data)
	logCount = len(lines)
	if logCount > logRotateAt {
		rotateLogLocked(lines)
	}
}

func rotateLogLocked(lines [][]byte) {
	if len(lines) <= maxLogLines {
		logCount = len(lines)
		return
	}
	trimmed := lines[len(lines)-maxLogLines:]
	var buf bytes.Buffer
	for _, l := range trimmed {
		buf.Write(l)
		buf.WriteByte('\n')
	}
	if err := atomicWrite(logFile, buf.Bytes(), 0644); err != nil {
		logMsg("gagal rotasi log: " + err.Error())
		return
	}
	logCount = maxLogLines
}

func writeLog(entry ActivityLog) {
	logMu.Lock()
	defer logMu.Unlock()

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	line, _ := json.Marshal(entry)
	_, _ = f.Write(append(line, '\n'))
	_ = f.Close()

	logCount++
	if logCount > logRotateAt {
		data, err := os.ReadFile(logFile)
		if err != nil {
			return
		}
		rotateLogLocked(splitLogLines(data))
	}
}

func resetLog() error {
	logMu.Lock()
	defer logMu.Unlock()
	if err := os.WriteFile(logFile, []byte{}, 0644); err != nil {
		return err
	}
	logCount = 0
	return nil
}

func readLog() ([]ActivityLog, error) {
	logMu.Lock()
	defer logMu.Unlock()

	data, err := os.ReadFile(logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []ActivityLog{}, nil
		}
		return nil, err
	}

	lines := splitLogLines(data)
	var logs []ActivityLog
	for _, line := range lines {
		var l ActivityLog
		if json.Unmarshal(line, &l) == nil {
			logs = append(logs, l)
		}
	}

	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}
	return logs, nil
}
