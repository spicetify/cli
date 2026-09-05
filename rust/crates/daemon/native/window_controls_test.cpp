#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <stdexcept>
#include <iostream>

using Begin = void *(*)(const wchar_t *);
using End = bool (*)(void *);
void require(bool value, const char *message) { if (!value) throw std::runtime_error(message); }
std::wstring executable() {
    wchar_t path[32768]; GetModuleFileNameW(nullptr, path, 32768); return path;
}
LRESULT CALLBACK host_proc(HWND window, UINT message, WPARAM w, LPARAM l) {
    if (message == WM_NCHITTEST) return l;
    if (message == WM_NCDESTROY) PostQuitMessage(0);
    return DefWindowProcW(window, message, w, l);
}
int host() {
    WNDCLASSW type{}; type.lpfnWndProc = host_proc; type.hInstance = GetModuleHandleW(nullptr);
    type.lpszClassName = L"Chrome_WidgetWin_1";
    require(RegisterClassW(&type) != 0, "register host class");
    HWND window = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, type.lpszClassName,
        L"Spicetify native window test", WS_POPUP | WS_VISIBLE, -32000, -32000, 100, 100,
        nullptr, nullptr, type.hInstance, nullptr);
    require(window != nullptr, "create host window");
    MSG message;
    while (GetMessageW(&message, nullptr, 0, 0) > 0) DispatchMessageW(&message);
    return 0;
}
struct Child {
    PROCESS_INFORMATION info{};
    Child(const std::wstring &arguments) {
        std::wstring line = L"\"" + executable() + L"\" " + arguments;
        STARTUPINFOW startup{}; startup.cb = sizeof(startup);
        require(CreateProcessW(nullptr, line.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW,
            nullptr, nullptr, &startup, &info) != FALSE, "start native test child");
    }
    ~Child() {
        if (WaitForSingleObject(info.hProcess, 0) == WAIT_TIMEOUT) TerminateProcess(info.hProcess, 1);
        CloseHandle(info.hProcess); CloseHandle(info.hThread);
    }
};
HWND find_host() { return FindWindowW(L"Chrome_WidgetWin_1", L"Spicetify native window test"); }
int wmain(int argc, wchar_t **argv) {
    try {
        if (argc > 1 && std::wstring(argv[1]) == L"--host") return host();
        require(argc >= 2, "DLL path required");
        bool owner = std::wstring(argv[1]) == L"--owner";
        const wchar_t *path = owner ? argv[2] : argv[1];
        HMODULE library = LoadLibraryW(path);
        require(library != nullptr, "load test DLL");
        auto begin = reinterpret_cast<Begin>(GetProcAddress(library, "begin_window_controls"));
        auto end = reinterpret_cast<End>(GetProcAddress(library, "end_window_controls"));
        require(begin && end, "resolve test DLL exports");
        if (owner) {
            require(begin(executable().c_str()) != nullptr, "acquire in child owner");
            require(SendMessageW(find_host(), WM_NCHITTEST, 0, HTCLOSE) == HTCLIENT, "child owner filters hits");
            return 0; // Simulate daemon death without releasing its session.
        }
        Child target(L"--host");
        HWND window = nullptr;
        for (int attempt = 0; attempt < 100 && !window; ++attempt) { Sleep(25); window = find_host(); }
        require(window != nullptr, "find host window");
        require(begin(L"C:\\not-the-spotify-executable.exe") == nullptr, "reject other process images");
        for (int iteration = 0; iteration < 3; ++iteration) {
            void *session = begin(executable().c_str());
            require(session != nullptr, "install hit-test filter");
            require(begin(executable().c_str()) == nullptr, "reject competing owner");
            for (int hit : {HTCLIENT, HTCAPTION, HTSYSMENU, HTMINBUTTON, HTMAXBUTTON, HTCLOSE, HTLEFT, HTBOTTOMRIGHT}) {
                bool control = hit == HTSYSMENU || hit == HTMINBUTTON || hit == HTMAXBUTTON || hit == HTCLOSE;
                require(SendMessageW(window, WM_NCHITTEST, 0, hit) == (control ? HTCLIENT : hit), "filter controls and preserve drag/resize");
            }
            require(end(session), "acknowledge release");
            require(SendMessageW(window, WM_NCHITTEST, 0, HTCLOSE) == HTCLOSE, "restore hits after release");
        }
        {
            Child dying(L"--owner \"" + std::wstring(path) + L"\"");
            require(WaitForSingleObject(dying.info.hProcess, 5000) == WAIT_OBJECT_0, "owner exits");
            DWORD status = 1; GetExitCodeProcess(dying.info.hProcess, &status);
            require(status == 0, "owner acquired filter before exit");
            for (int attempt = 0; attempt < 100 && SendMessageW(window, WM_NCHITTEST, 0, HTCLOSE) != HTCLOSE; ++attempt) Sleep(25);
            require(SendMessageW(window, WM_NCHITTEST, 0, HTCLOSE) == HTCLOSE, "restore hits after owner death");
        }
        PostMessageW(window, WM_CLOSE, 0, 0);
        require(WaitForSingleObject(target.info.hProcess, 5000) == WAIT_OBJECT_0, "host exits cleanly");
        std::cout << "Native window controls: ownership, hit filtering, release, reacquire and owner death passed\n";
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n'; return 1;
    }
}
