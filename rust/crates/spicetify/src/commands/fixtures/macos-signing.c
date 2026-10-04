#include <libkern/OSCacheControl.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>

int main(void) {
    puts("desktop-update/v2/update");
    void *memory = mmap(NULL, 4096, PROT_READ | PROT_WRITE | PROT_EXEC,
                        MAP_PRIVATE | MAP_ANON | MAP_JIT, -1, 0);
    if (memory == MAP_FAILED) {
        perror("mmap MAP_JIT");
        return 1;
    }
#if defined(SPICETIFY_ARM64)
    unsigned int instructions[] = {0x52800540, 0xd65f03c0};
    pthread_jit_write_protect_np(0);
#else
    unsigned char instructions[] = {0xb8, 42, 0, 0, 0, 0xc3};
#endif
    memcpy(memory, instructions, sizeof(instructions));
    sys_icache_invalidate(memory, sizeof(instructions));
#if defined(SPICETIFY_ARM64)
    pthread_jit_write_protect_np(1);
#endif
    int result = ((int (*)(void))memory)();
    printf("JIT result: %d\n", result);
    munmap(memory, 4096);
    return result == 42 ? 0 : 2;
}
