#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <commctrl.h>
#include <new>
#include <cwchar>

namespace {
constexpr UINT_PTR subclass_id = 0x53504943;
constexpr LRESULT acknowledged = 0x53504943;
UINT command() {
    static const UINT value = RegisterWindowMessageW(L"Spicetify.WindowControls.v1");
    return value;
}
bool button_hit(LRESULT hit) {
    return hit == HTMINBUTTON || hit == HTMAXBUTTON || hit == HTCLOSE || hit == HTSYSMENU;
}
void event_name(DWORD pid, wchar_t (&name)[80]) {
    swprintf_s(name, L"Local\\Spicetify.WindowControls.%lu", pid);
}
struct Owner { HANDLE process; HANDLE stop; DWORD pid; UINT_PTR timer; };
LRESULT CALLBACK filter(HWND, UINT, WPARAM, LPARAM, UINT_PTR, DWORD_PTR);
void detach(HWND window, Owner *owner) {
    KillTimer(window, owner->timer);
    RemoveWindowSubclass(window, filter, subclass_id);
    CloseHandle(owner->process);
    CloseHandle(owner->stop);
    delete owner;
}
LRESULT CALLBACK filter(HWND window, UINT message, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR data) {
    auto *owner = reinterpret_cast<Owner *>(data);
    if (message == command() && w == owner->pid) {
        if (!l) detach(window, owner);
        return acknowledged;
    }
    if (message == WM_TIMER && w == owner->timer) {
        if (WaitForSingleObject(owner->process, 0) != WAIT_TIMEOUT || WaitForSingleObject(owner->stop, 0) != WAIT_TIMEOUT) detach(window, owner);
        return 0;
    }
    if (message == WM_NCDESTROY) detach(window, owner);
    // Windows routes these before the renderer. Keep drag/resize/system-menu
    // shortcuts intact; only mouse hits on the hidden controls become content.
    if ((message == WM_NCLBUTTONDOWN || message == WM_NCLBUTTONDBLCLK) && button_hit(w)) return 0;
    LRESULT result = DefSubclassProc(window, message, w, l);
    return message == WM_NCHITTEST && button_hit(result) ? HTCLIENT : result;
}
HMODULE pin() {
    static HMODULE module = [] {
        HMODULE value = nullptr;
        // A subclass can outlive the installing daemon. Its timer removes it
        // after that process exits; pinning keeps callbacks valid until then.
        GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_PIN,
            reinterpret_cast<LPCWSTR>(filter), &value);
        return value;
    }();
    return module;
}
LRESULT CALLBACK hook(int code, WPARAM w, LPARAM l) {
    if (code >= 0) {
        const auto *event = reinterpret_cast<const CWPSTRUCT *>(l);
        if (event->message == command() && event->lParam == 1) {
            DWORD_PTR existing = 0;
            if (!GetWindowSubclass(event->hwnd, filter, subclass_id, &existing)) {
                HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, static_cast<DWORD>(event->wParam));
                wchar_t name[80]; event_name(static_cast<DWORD>(event->wParam), name);
                HANDLE stop = OpenEventW(SYNCHRONIZE, FALSE, name);
                auto *owner = process && stop ? new (std::nothrow) Owner{process, stop, static_cast<DWORD>(event->wParam), 0} : nullptr;
                if (owner && pin() && SetWindowSubclass(event->hwnd, filter, subclass_id, reinterpret_cast<DWORD_PTR>(owner))) {
                    owner->timer = SetTimer(event->hwnd, reinterpret_cast<UINT_PTR>(owner), 1000, nullptr);
                    if (!owner->timer) detach(event->hwnd, owner);
                } else {
                    if (process) CloseHandle(process);
                    if (stop) CloseHandle(stop);
                    delete owner;
                }
            }
        }
    }
    return CallNextHookEx(nullptr, code, w, l);
}
bool same_file(const wchar_t *a, const wchar_t *b) {
    HANDLE left = CreateFileW(a, 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr);
    HANDLE right = CreateFileW(b, 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr);
    BY_HANDLE_FILE_INFORMATION x{}, y{};
    bool equal = left != INVALID_HANDLE_VALUE && right != INVALID_HANDLE_VALUE &&
        GetFileInformationByHandle(left, &x) && GetFileInformationByHandle(right, &y) &&
        x.dwVolumeSerialNumber == y.dwVolumeSerialNumber && x.nFileIndexHigh == y.nFileIndexHigh && x.nFileIndexLow == y.nFileIndexLow;
    if (left != INVALID_HANDLE_VALUE) CloseHandle(left);
    if (right != INVALID_HANDLE_VALUE) CloseHandle(right);
    return equal;
}
struct Search { const wchar_t *exe; HWND window; DWORD pid; DWORD thread; };
BOOL CALLBACK find_window(HWND window, LPARAM data) {
    auto *search = reinterpret_cast<Search *>(data);
    wchar_t name[64]{};
    GetClassNameW(window, name, 64);
    if (!IsWindowVisible(window) || (wcscmp(name, L"Chrome_WidgetWin_0") && wcscmp(name, L"Chrome_WidgetWin_1")) || GetWindow(window, GW_OWNER)) return TRUE;
    DWORD pid = 0;
    DWORD thread = GetWindowThreadProcessId(window, &pid);
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!process) return TRUE;
    wchar_t exe[32768]; DWORD size = 32768;
    bool matches = QueryFullProcessImageNameW(process, 0, exe, &size) && same_file(search->exe, exe);
    CloseHandle(process);
    if (!matches) return TRUE;
    search->window = window; search->pid = pid; search->thread = thread;
    return FALSE;
}
struct Session { HWND window; DWORD pid; HANDLE stop; };
bool send(HWND window, LPARAM enabled) {
    DWORD_PTR result = 0;
    return SendMessageTimeoutW(window, command(), GetCurrentProcessId(), enabled,
        SMTO_ABORTIFHUNG | SMTO_BLOCK, 2000, &result) && result == acknowledged;
}
}

extern "C" __declspec(dllexport) void *begin_window_controls(const wchar_t *exe) {
    Search search{exe, nullptr, 0, 0};
    EnumWindows(find_window, reinterpret_cast<LPARAM>(&search));
    if (!search.window) return nullptr;
    wchar_t name[80]; event_name(GetCurrentProcessId(), name);
    HANDLE stop = CreateEventW(nullptr, TRUE, FALSE, name);
    if (!stop) return nullptr;
    // A prior timed-out detach must finish before a new owner reuses its name.
    if (GetLastError() == ERROR_ALREADY_EXISTS) { CloseHandle(stop); return nullptr; }
    HMODULE module = nullptr;
    if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
        reinterpret_cast<LPCWSTR>(hook), &module)) { CloseHandle(stop); return nullptr; }
    HHOOK installed = SetWindowsHookExW(WH_CALLWNDPROC, hook, module, search.thread);
    bool ok = installed && send(search.window, 1);
    if (installed) UnhookWindowsHookEx(installed);
    FreeLibrary(module);
    if (!ok) { SetEvent(stop); CloseHandle(stop); return nullptr; }
    auto *session = new (std::nothrow) Session{search.window, search.pid, stop};
    if (!session) { SetEvent(stop); send(search.window, 0); CloseHandle(stop); }
    return session;
}
extern "C" __declspec(dllexport) bool end_window_controls(void *value) {
    auto *session = static_cast<Session *>(value);
    DWORD pid = 0;
    SetEvent(session->stop);
    GetWindowThreadProcessId(session->window, &pid);
    bool ok = pid != session->pid || send(session->window, 0);
    CloseHandle(session->stop);
    delete session;
    return ok;
}
extern "C" __declspec(dllexport) bool window_controls_active(void *value) {
    auto *session = static_cast<Session *>(value);
    DWORD pid = 0;
    GetWindowThreadProcessId(session->window, &pid);
    return pid == session->pid && send(session->window, 1);
}
