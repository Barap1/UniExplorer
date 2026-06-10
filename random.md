# Reproducibility Runbook

Workspace created: 2026-06-09, America/New_York.

Last updated: 2026-06-10.

This document records the exact work performed to set up the LwIP bounded
model checking workspace, the code that was written, the commands used, and
the expected results. It is intended to let another reviewer reproduce
`LWIP-BMC-001` from a clean checkout of this repository.

## Executive summary

The verified target is upstream LwIP's IPv4 receive path:

```text
lwip/src/core/ipv4/ip4.c:ip4_input
```

The concrete result is `LWIP-BMC-001`: `ip4_input` reads IPv4 header fields
before validating that the first pbuf segment contains an IPv4 header.

Two independent checks were produced:

1. CBMC finds out-of-bounds pointer dereferences when `p.len == 0`.
2. A native Windows guard-page reproducer crashes with access violation
   `0xC0000005` when the same short-pbuf shape is passed to the real
   `ip4_input` implementation.

The current disclosure status is private draft only. This is a concrete local
bug candidate, not an upstream-confirmed vulnerability or CVE.

## Source repositories

Official upstream LwIP repositories were cloned from Savannah:

| Repository | Remote | Commit |
| --- | --- | --- |
| `lwip/` | `https://git.savannah.nongnu.org/git/lwip.git` | `8e75a40acfea6b05ee643099e41f3b2e11ee464d` |
| `lwip-contrib/` | `https://git.savannah.nongnu.org/git/lwip/lwip-contrib.git` | `058e53d5b3a5a4639823e6f7cdc96f832643bfab` |

The clone commands used were:

```sh
git clone https://git.savannah.nongnu.org/git/lwip.git lwip
git clone https://git.savannah.nongnu.org/git/lwip/lwip-contrib.git lwip-contrib
```

Savannah redirected both HTTPS remotes to
`https://https.git.savannah.gnu.org/...` during cloning.

## Repository structure

The relevant local files are:

```text
lwip-bmc/
  FINDINGS.md
  REPRODUCIBILITY.md
  tools.md
  bmc/
    README.md
    harness_ip4_input.c
    lwip_stubs.c
    run_cbmc_ip4.ps1
    run_cbmc_ip4.sh
    include/
      arch/cc.h
      lwipopts.h
      string.h
    results/
      ip4_bound_64_min_0.log
      ip4_short_pbuf_trace.log
      ip4_bound_64_min_20.log
      ip4_bound_128_min_20.log
  reproducers/
    README.md
    build_repro_ip4_short_pbuf.ps1
    repro_ip4_short_pbuf.c
    lwip_repro_stubs.c
    include/
      arch/cc.h
      lwipopts.h
    results/
      ip4_short_pbuf_guard_page.log
  disclosure/
    DRAFT_REPORT.md
```

## Tools used

The work was done on Windows with portable tools extracted under `C:\tmp`.
See `tools.md` for installation notes.

| Tool | Version/details used |
| --- | --- |
| OS | Microsoft Windows 10.0.26200, x64 |
| Git | `git version 2.47.0.windows.2` |
| CBMC | `C:\tmp\cbmc-6.9.0\cbmc\bin\cbmc.exe`, `6.9.0 (cbmc-6.9.0)` |
| GCC | `C:\tmp\w64devkit\bin\gcc.exe`, `16.1.0` |
| make | w64devkit GNU Make `4.4.1` |
| CMake | w64devkit CMake `4.3.2` |

Before running commands in a fresh PowerShell terminal, set:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
$env:CBMC_EXE = "C:\tmp\cbmc-6.9.0\cbmc\bin\cbmc.exe"
$env:PATH = "C:\tmp\w64devkit\bin;$env:PATH"
$env:CC = "C:\tmp\w64devkit\bin\gcc.exe"
```

## What code was written

### CBMC harness

File:

```text
bmc/harness_ip4_input.c
```

Purpose:

- Build a minimal symbolic caller for `ip4_input`.
- Create one `struct pbuf` and one `struct netif`.
- Make the packet bytes symbolic with `__CPROVER_havoc_object(packet)`.
- Make `packet_len` symbolic with `nondet_ushort()`.
- Constrain only the packet length bound:

  ```c
  __CPROVER_assume(packet_len <= PACKET_BOUND);
  __CPROVER_assume(packet_len >= MIN_PACKET_LEN);
  ```

- Set the pbuf so CBMC sees exactly `packet_len` accessible bytes:

  ```c
  p.payload = &packet[PACKET_BOUND - packet_len];
  p.tot_len = packet_len;
  p.len = packet_len;
  ```

The important modeling detail is the payload placement. If `packet_len` is
zero, `p.payload` points one-past the `packet` object. Any read through that
pointer is therefore detected by CBMC as a pointer-bounds violation.

### CBMC support stubs

File:

```text
bmc/lwip_stubs.c
```

Purpose:

- Provide the global LwIP symbols required by `ip4_input`, including
  `ip_data`, `netif_list`, and `netif_default`.
- Provide minimal implementations of pbuf helpers such as `pbuf_free`,
  `pbuf_realloc`, `pbuf_remove_header`, and `pbuf_header_force`.
- Stub deeper protocol dispatch (`raw_input`, `udp_input`, `tcp_input`,
  `icmp_input`) so the harness stays focused on the IPv4 input parser.
- Return a symbolic checksum from `inet_chksum` so checksum success/failure is
  not artificially fixed by the harness.
- Provide local byte-order functions `lwip_htons` and `lwip_htonl`.

These stubs are intentionally narrow. They exist only to link and analyze
`ip4_input`, not to emulate a full LwIP stack.

### CBMC freestanding include shim

Files:

```text
bmc/include/arch/cc.h
bmc/include/lwipopts.h
bmc/include/string.h
```

Purpose:

- Provide the LwIP architecture typedefs and configuration needed to parse the
  relevant LwIP source under CBMC.
- Keep the CBMC compilation freestanding and small.
- Avoid pulling platform headers that cause unrelated parse or environment
  noise in the model-checking target.

The relevant configuration enables IPv4, ICMP, RAW, UDP, TCP, IP options, and
IP reassembly while disabling IPv6:

```text
NO_SYS=0
LWIP_IPV4=1
LWIP_IPV6=0
LWIP_ICMP=1
LWIP_RAW=1
LWIP_UDP=1
LWIP_TCP=1
IP_OPTIONS_ALLOWED=1
IP_REASSEMBLY=1
```

### CBMC run scripts

Files:

```text
bmc/run_cbmc_ip4.ps1
bmc/run_cbmc_ip4.sh
```

Purpose:

- Run CBMC against:

  ```text
  bmc/harness_ip4_input.c
  bmc/lwip_stubs.c
  lwip/src/core/ipv4/ip4.c
  lwip/src/core/ipv4/ip4_addr.c
  ```

- Enable pointer, bounds, primitive pointer, shift, divide-by-zero, overflow,
  and conversion checks.
- Accept environment variables:

  ```text
  PACKET_BOUND
  MIN_PACKET_LEN
  UNWIND
  CBMC_EXE
  ```

- Write logs under `bmc/results/`.
- Preserve the CBMC process exit code.

### Native reproducer

File:

```text
reproducers/repro_ip4_short_pbuf.c
```

Purpose:

- Validate the CBMC counterexample outside CBMC with a normal compiler.
- Allocate two pages with Windows `VirtualAlloc`.
- Mark the second page `PAGE_NOACCESS` with `VirtualProtect`.
- Set:

  ```c
  p.payload = region + sys_info.dwPageSize;
  p.tot_len = 0;
  p.len = 0;
  ```

- Call the real `ip4_input(&p, &inp)`.

Expected result:

```text
0xC0000005 access violation
```

PowerShell reports that as:

```text
exit=-1073741819
```

The reproducer also supports a guard-page self-test:

```powershell
$env:REPRO_GUARD_SELFTEST = "1"
```

With the self-test enabled, the test reads the guard page before calling
`ip4_input`; this confirms the guard page itself is active.

### Native reproducer stubs

File:

```text
reproducers/lwip_repro_stubs.c
```

Purpose:

- Provide the same minimal LwIP environment as the CBMC harness, but for GCC.
- Link the real `ip4_input`, `ip4_addr.c`, and `def.c` without building a full
  port.
- Keep protocol dispatch inert so the crash location remains the header read in
  `ip4_input`.

### Native build script

File:

```text
reproducers/build_repro_ip4_short_pbuf.ps1
```

Purpose:

- Compile the concrete reproducer with GCC from w64devkit.
- Include local reproducer headers and upstream LwIP headers.
- Link these source files:

  ```text
  reproducers/repro_ip4_short_pbuf.c
  reproducers/lwip_repro_stubs.c
  lwip/src/core/def.c
  lwip/src/core/ipv4/ip4.c
  lwip/src/core/ipv4/ip4_addr.c
  ```

- Run the resulting executable.
- Return the executable's exit code.

## Reproducing the CBMC failure

Start from:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
$env:CBMC_EXE = "C:\tmp\cbmc-6.9.0\cbmc\bin\cbmc.exe"
$env:PATH = "C:\tmp\w64devkit\bin;$env:PATH"
Remove-Item Env:\MIN_PACKET_LEN -ErrorAction SilentlyContinue
Remove-Item Env:\PACKET_BOUND -ErrorAction SilentlyContinue
Remove-Item Env:\UNWIND -ErrorAction SilentlyContinue
```

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\bmc\run_cbmc_ip4.ps1
```

Default bounds:

```text
PACKET_BOUND=64
MIN_PACKET_LEN=0
UNWIND=8
```

Expected result:

```text
VERIFICATION FAILED
** 3 of 644 failed
```

Expected failing properties:

```text
ip4_input.pointer_dereference.11 line 480 pointer outside object bounds in iphdr->_v_hl
ip4_input.pointer_dereference.17 line 498 pointer outside object bounds in iphdr->_v_hl
ip4_input.pointer_dereference.23 line 500 pointer outside object bounds in iphdr->_len
```

Expected log:

```text
bmc/results/ip4_bound_64_min_0.log
```

The saved short-pbuf trace is:

```text
bmc/results/ip4_short_pbuf_trace.log
```

Counterexample shape:

```text
packet_len=0
p.len=0
p.tot_len=0
p.payload=&packet[64]
```

Root cause in `ip4_input`:

```text
lwip/src/core/ipv4/ip4.c:479 assigns iphdr = (struct ip_hdr *)p->payload
lwip/src/core/ipv4/ip4.c:480 reads IPH_V(iphdr)
lwip/src/core/ipv4/ip4.c:498 reads IPH_HL_BYTES(iphdr)
lwip/src/core/ipv4/ip4.c:500 reads IPH_LEN(iphdr)
```

Those reads occur before a first-pbuf length check proves that `p->payload`
contains an IPv4 header.

## Reproducing the CBMC passing control

The failing state is specifically short first-pbuf input. To confirm that,
repeat the run with a documented caller assumption that at least one IPv4
header is present:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
$env:CBMC_EXE = "C:\tmp\cbmc-6.9.0\cbmc\bin\cbmc.exe"
$env:PATH = "C:\tmp\w64devkit\bin;$env:PATH"
$env:MIN_PACKET_LEN = "20"
$env:PACKET_BOUND = "64"
powershell -NoProfile -ExecutionPolicy Bypass -File .\bmc\run_cbmc_ip4.ps1
```

Expected result:

```text
VERIFICATION SUCCESSFUL
** 0 of 644 failed
```

Expected log:

```text
bmc/results/ip4_bound_64_min_20.log
```

Then repeat with a larger packet bound:

```powershell
$env:MIN_PACKET_LEN = "20"
$env:PACKET_BOUND = "128"
powershell -NoProfile -ExecutionPolicy Bypass -File .\bmc\run_cbmc_ip4.ps1
```

Expected result:

```text
VERIFICATION SUCCESSFUL
** 0 of 644 failed
```

Expected log:

```text
bmc/results/ip4_bound_128_min_20.log
```

This control does not prove the whole function correct. It supports the narrower
claim that the reported CBMC failure is caused by allowing a first pbuf shorter
than `IP_HLEN`.

## Reproducing the native guard-page crash

Start from:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
$env:PATH = "C:\tmp\w64devkit\bin;$env:PATH"
$env:CC = "C:\tmp\w64devkit\bin\gcc.exe"
Remove-Item Env:\REPRO_GUARD_SELFTEST -ErrorAction SilentlyContinue
```

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\reproducers\build_repro_ip4_short_pbuf.ps1
```

Expected stderr shape:

```text
guard region=0000... payload=0000... page_size=4096
```

Expected PowerShell exit code:

```text
-1073741819
```

The saved run log is:

```text
reproducers/results/ip4_short_pbuf_guard_page.log
```

The build artifact is intentionally ignored by git:

```text
reproducers/build/repro_ip4_short_pbuf.exe
```

## Optional guard-page self-test

To prove that the guard page faults independently of LwIP:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
$env:PATH = "C:\tmp\w64devkit\bin;$env:PATH"
$env:CC = "C:\tmp\w64devkit\bin\gcc.exe"
$env:REPRO_GUARD_SELFTEST = "1"
powershell -NoProfile -ExecutionPolicy Bypass -File .\reproducers\build_repro_ip4_short_pbuf.ps1
```

Expected result is also an access violation, but it occurs at the intentional
self-test read before `ip4_input`.

Remove the variable before reproducing the LwIP crash:

```powershell
Remove-Item Env:\REPRO_GUARD_SELFTEST -ErrorAction SilentlyContinue
```

## Caller reachability audit performed

The initial source audit checked common receive paths to decide whether the
short-pbuf state could be a real caller shape or only a harness artifact.

Observed:

- Ethernet receive paths normally remove an Ethernet header before calling
  `ip4_input`; common Ethernet framing usually leaves at least enough bytes for
  an IPv4 header.
- PPP source inspection looked more interesting. `ppp_input` checks that the
  packet has at least the two-byte PPP protocol field, removes that protocol
  field, and dispatches `PPP_IP` to `ip4_input`. No visible post-removal
  `pb->len >= IP_HLEN` check was found in that path during this pass.
- A minimal PPP payload shape for follow-up validation is protocol `PPP_IP`
  (`00 21`) with no following IPv4 bytes after PPP framing/FCS processing.

This audit is why the finding is recorded as medium-high confidence rather than
fully confirmed. The next validation step should be a full PPP-level reproducer
that demonstrates a malformed PPP frame reaching `ip4_input` in a normal LwIP
PPP configuration.

## How to verify the saved results

From the repository root:

```powershell
cd "C:\Users\aarav\OneDrive\Documents\CheckedNet Temp\lwip-bmc"
Select-String -Path .\bmc\results\ip4_bound_64_min_0.log -Pattern "VERIFICATION FAILED","pointer outside object bounds"
Select-String -Path .\bmc\results\ip4_bound_64_min_20.log -Pattern "VERIFICATION SUCCESSFUL","0 of 644 failed"
Select-String -Path .\bmc\results\ip4_bound_128_min_20.log -Pattern "VERIFICATION SUCCESSFUL","0 of 644 failed"
Get-Content .\reproducers\results\ip4_short_pbuf_guard_page.log
```

Expected:

- The first command finds the CBMC failure and pointer-bounds properties.
- The two `MIN_PACKET_LEN=20` logs show successful verification.
- The reproducer log records `exit=-1073741819`.

## Interpretation rules

Do not treat every CBMC failure as a vulnerability. For each failure:

1. Check whether the harness modeled a caller state that real LwIP callers can
   actually produce.
2. Check whether missing configuration or missing caller assumptions explain the
   result.
3. Convert plausible symbolic counterexamples into concrete native reproducers.
4. Record the exact commit, configuration, command, and result.
5. Do not publish or request a CVE until caller reachability is validated.

For `LWIP-BMC-001`, steps 1 through 4 are partially complete:

- CBMC failure exists.
- Native guard-page reproduction exists.
- Passing controls with `MIN_PACKET_LEN=20` exist.
- Source-level PPP reachability looks plausible.
- Full PPP-frame reachability still needs confirmation.
