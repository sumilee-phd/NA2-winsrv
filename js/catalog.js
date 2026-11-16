/* 기본 자료: 서비스 목록, 로컬 그룹, 로컬 보안 정책의 보안 옵션.
 * 이름은 실기 연습 프로그램과 Windows Server의 표시 이름을 따랐고, 설명 문장은 핵심어(6to4, WNS, 하트비트 등)를 살려 새로 썼다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSCatalog = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LS = 'Local System', LSV = 'Local Service', NS = 'Network Service';
  var ON = '시작됨', OFF = '중지됨';
  // [표시 이름, 서비스 이름, 설명, 시작 유형, 상태, 로그온, 일시 중지 가능]
  var SERVICES = [
    ['Background Intelligent Transfer Service', 'BITS', '사용하지 않는 네트워크 대역폭을 이용해 파일을 백그라운드로 전송합니다. 이 서비스를 중지하면 BITS를 쓰는 응용 프로그램이 파일을 자동으로 내려받지 못합니다.', '수동', OFF, LS],
    ['Base Filtering Engine', 'BFE', '방화벽과 IPsec(인터넷 프로토콜 보안) 정책을 관리하고 사용자 모드 필터링을 구현합니다. 이 서비스를 중지하면 방화벽과 IPsec 보안이 크게 약해집니다.', '자동', ON, LSV],
    ['COM+ Event System', 'EventSystem', '구성 요소 개체 모델(COM) 구성 요소에 이벤트를 자동으로 배포하는 시스템 이벤트 알림 서비스(SENS)를 지원합니다.', '자동', ON, LSV],
    ['Cryptographic Services', 'CryptSvc', '카탈로그 데이터베이스, 루트 인증서, 키 서비스를 관리해 Windows 파일과 응용 프로그램의 디지털 서명을 확인합니다.', '자동', ON, NS],
    ['DCOM Server Process Launcher', 'DcomLaunch', 'COM 서버와 DCOM 서버를 요청에 따라 시작합니다. 이 서비스를 중지하면 COM·DCOM을 쓰는 프로그램이 제대로 동작하지 않습니다.', '자동', ON, LS],
    ['DHCP Client', 'Dhcp', '이 컴퓨터의 IP 주소를 등록·갱신하고 DNS 레코드를 업데이트합니다. 이 서비스를 중지하면 동적 IP 주소와 DNS 업데이트를 받지 못합니다.', '자동', ON, LSV],
    ['DHCP Server', 'DHCPServer', '네트워크의 클라이언트 컴퓨터에 IP 주소와 구성 옵션을 임대합니다.', '자동', ON, NS],
    ['Diagnostic Policy Service', 'DPS', 'Windows 구성 요소의 문제를 감지하고 해결하며 진단 결과를 기록합니다.', '자동(지연된 시작)', ON, LSV],
    ['Distributed Transaction Coordinator', 'MSDTC', '데이터베이스, 메시지 큐, 파일 시스템 같은 여러 리소스 관리자에 걸친 트랜잭션을 조정합니다.', '자동(지연된 시작)', ON, NS],
    ['DNS Client', 'Dnscache', '도메인 이름 시스템(DNS) 이름을 캐시하고 이 컴퓨터의 전체 컴퓨터 이름을 등록합니다.', '자동', ON, NS],
    ['DNS Server', 'DNS', '이름을 IP 주소로 바꾸는 DNS 조회 요청과 업데이트 요청에 응답합니다.', '자동', ON, LS],
    ['Encrypting File System (EFS)', 'EFS', '암호화된 파일을 NTFS 파일 시스템 볼륨에 저장하는 핵심 파일 암호화 기술을 제공합니다. 이 서비스를 중지하거나 사용하지 않으면 응용 프로그램이 암호화된 파일에 접근하지 못합니다.', '수동', OFF, LS],
    ['Extensible Authentication Protocol', 'Eaphost', '유선·무선 네트워크 인증에 쓰는 EAP(확장할 수 있는 인증 프로토콜) 서비스를 제공합니다.', '수동', OFF, LS],
    ['Function Discovery Provider Host', 'fdPHost', '네트워크 검색 기능의 공급자를 호스팅합니다. SSDP와 WS-Discovery 프로토콜을 씁니다.', '수동', OFF, LSV],
    ['Group Policy Client', 'gpsvc', '관리자가 그룹 정책으로 지정한 설정을 이 컴퓨터에 적용합니다.', '자동', ON, LS],
    ['Hyper-V PowerShell Direct 서비스', 'vmicvmsession', '호스트에서 네트워크 연결 없이 PowerShell로 이 가상 컴퓨터를 관리하는 기능을 제공합니다.', '수동', OFF, LS],
    ['Hyper-V 게스트 서비스 인터페이스', 'vmicguestinterface', 'Hyper-V 호스트가 이 가상 컴퓨터의 특정 서비스와 통신하는 인터페이스를 제공합니다.', '수동', OFF, LS],
    ['Hyper-V 게스트 종료 서비스', 'vmicshutdown', 'Hyper-V 호스트가 이 가상 컴퓨터의 운영 체제를 종료하는 방법을 제공합니다.', '수동', OFF, LS],
    ['Hyper-V 데이터 교환 서비스', 'vmickvpexchange', '가상 컴퓨터와 실제 컴퓨터의 운영 체제 사이에서 데이터를 교환하는 방법을 제공합니다.', '수동', OFF, LS],
    ['Hyper-V 시간 동기화 서비스', 'vmictimesync', '이 가상 컴퓨터의 시스템 시간을 실제 컴퓨터의 시스템 시간과 동기화합니다.', '수동', OFF, LSV],
    ['Hyper-V 원격 데스크톱 가상화 서비스', 'vmicrdv', '가상 컴퓨터와 실제 컴퓨터의 가상화 스택이 원격 데스크톱 연결을 처리하도록 통신하는 플랫폼을 제공합니다.', '수동', OFF, LS],
    ['Hyper-V 하트비트 서비스', 'vmicheartbeat', '정기적으로 하트비트를 보고해 이 가상 컴퓨터의 상태를 모니터링합니다. 이 서비스가 중지되면 가상 컴퓨터가 응답하지 않는 것으로 보고됩니다.', '수동', OFF, LS],
    ['IKE and AuthIP IPsec Keying Modules', 'IKEEXT', 'IPsec의 IKE(인터넷 키 교환)와 AuthIP 키 모듈을 호스팅해 인증과 키 교환을 처리합니다.', '자동', ON, LS],
    ['IP Helper', 'iphlpsvc', '6to4, ISATAP, Port Proxy, Teredo 같은 IPv6 전환 기술과 IP-HTTPS로 터널 연결을 제공합니다. 이 서비스가 중지되면 이 기술들이 제공하는 연결 기능을 쓸 수 없습니다.', '자동', ON, LS],
    ['IPsec Policy Agent', 'PolicyAgent', '네트워크 수준의 피어 인증, 데이터 원본 인증, 데이터 무결성, 암호화를 지원하는 IPsec 정책을 적용합니다.', '수동', ON, NS],
    ['KtmRm for Distributed Transaction Coordinator', 'KtmRm', 'Distributed Transaction Coordinator(MSDTC)와 커널 트랜잭션 관리자(KTM) 사이의 트랜잭션을 조정합니다.', '수동', OFF, NS],
    ['Link-Layer Topology Discovery Mapper', 'lltdsvc', '네트워크의 PC와 장치 토폴로지를 검색해 네트워크 맵을 만듭니다.', '수동', OFF, LSV],
    ['Microsoft FTP Service', 'ftpsvc', '이 서버를 FTP(파일 전송 프로토콜) 서버로 동작하게 합니다.', '자동', ON, LS, true],
    ['Netlogon', 'Netlogon', '사용자와 서비스를 인증하기 위해 이 컴퓨터와 도메인 컨트롤러 사이의 보안 채널을 유지합니다.', '수동', OFF, LS, true],
    ['Network Connections', 'Netman', '네트워크 연결 폴더의 개체(로컬 영역 연결, 원격 연결)를 관리합니다.', '수동', ON, LS],
    ['Network List Service', 'netprofm', '이 컴퓨터가 연결된 네트워크를 식별하고 네트워크 속성을 수집·저장하며 속성이 바뀌면 응용 프로그램에 알립니다.', '수동', ON, LSV],
    ['Network Location Awareness', 'NlaSvc', '네트워크 구성과 위치 정보를 수집·저장하고 정보가 바뀌면 응용 프로그램에 알립니다.', '자동', ON, NS],
    ['Performance Logs & Alerts', 'pla', '미리 정한 일정에 따라 로컬 또는 원격 컴퓨터의 성능 데이터를 수집해 로그에 기록하거나 경고를 발생시킵니다.', '수동', OFF, LSV],
    ['Plug and Play', 'PlugPlay', '사용자 개입이 거의 없이 하드웨어 변경을 인식하고 적응하게 합니다.', '수동', ON, LS],
    ['Print Spooler', 'Spooler', '인쇄 작업을 백그라운드에서 처리하고 프린터와의 상호 작용을 관리합니다.', '자동', ON, LS],
    ['Remote Access Connection Manager', 'RasMan', '이 컴퓨터에서 인터넷이나 다른 원격 네트워크로 연결하는 전화 접속·VPN 연결을 관리합니다.', '수동', OFF, LS],
    ['Remote Desktop Services', 'TermService', '사용자가 원격 컴퓨터에 대화형으로 연결하게 합니다. 원격 데스크톱과 원격 데스크톱 세션 호스트 서버가 이 서비스를 씁니다.', '수동', ON, NS],
    ['Remote Procedure Call (RPC)', 'RpcSs', 'COM·DCOM 서버의 서비스 제어 관리자 역할을 합니다. 개체 활성화 요청, 개체 내보내기 확인, 분산 가비지 수집을 처리합니다.', '자동', ON, NS],
    ['Remote Registry', 'RemoteRegistry', '원격 사용자가 이 컴퓨터의 레지스트리 설정을 수정할 수 있게 합니다.', '수동', OFF, LSV],
    ['Routing and Remote Access', 'RemoteAccess', '근거리 및 광역 네트워크 환경의 기업에 라우팅 서비스를 제공합니다.', '사용 안 함', OFF, LS],
    ['Secondary Logon', 'seclogon', '다른 사용자의 자격 증명으로 프로세스를 시작할 수 있게 합니다.', '수동', OFF, LS],
    ['Server', 'LanmanServer', '네트워크를 통한 파일, 인쇄, 명명된 파이프 공유를 지원합니다.', '자동', ON, LS, true],
    ['SNMP Trap', 'SNMPTRAP', '로컬 또는 원격 SNMP(단순 네트워크 관리 프로토콜) 에이전트가 만든 트랩 메시지를 받아 이 컴퓨터의 SNMP 관리 프로그램에 전달합니다.', '수동', OFF, LSV],
    ['Task Scheduler', 'Schedule', '사용자가 이 컴퓨터에서 자동 작업을 구성하고 예약할 수 있게 합니다.', '자동', ON, LS],
    ['TCP/IP NetBIOS Helper', 'lmhosts', 'TCP/IP를 통한 NetBIOS(NetBT) 서비스와 NetBIOS 이름 확인을 지원합니다.', '수동', ON, LSV],
    ['Windows Defender Firewall', 'mpssvc', '인터넷이나 네트워크를 통한 무단 액세스를 막아 이 컴퓨터를 보호합니다.', '자동', ON, LSV],
    ['Windows Event Log', 'EventLog', '이벤트와 이벤트 로그를 관리합니다. 이벤트 기록, 구독, 보관, 메타데이터 관리를 지원합니다.', '자동', ON, LSV],
    ['Windows Management Instrumentation', 'Winmgmt', '운영 체제, 장치, 응용 프로그램, 서비스의 관리 정보에 접근하는 공통 인터페이스와 개체 모델을 제공합니다.', '자동', ON, LS, true],
    ['Windows Remote Management (WS-Management)', 'WinRM', '원격 관리용 WS-Management 프로토콜을 구현합니다.', '자동', ON, NS],
    ['Windows Time', 'W32Time', '네트워크의 모든 클라이언트와 서버의 날짜와 시간 동기화를 유지합니다.', '수동', ON, LSV],
    ['Windows Update', 'wuauserv', 'Windows와 기타 프로그램의 업데이트를 검색하고 내려받아 설치합니다.', '수동', OFF, LS],
    ['Windows 푸시 알림 사용자 서비스', 'WpnUserService', '로컬 알림과 푸시 알림을 지원하는 Windows 알림 플랫폼을 사용자 세션에서 호스팅합니다.', '수동', ON, LS],
    ['Windows 푸시 알림 시스템 서비스', 'WpnService', '세션 0에서 실행되며 알림 플랫폼과 연결 공급자를 호스팅해 디바이스와 WNS 서버 사이의 연결을 처리합니다.', '자동', ON, LS],
    ['Workstation', 'LanmanWorkstation', 'SMB 프로토콜로 네트워크 연결을 만들고 유지합니다.', '자동', ON, NS, true],
    ['World Wide Web Publishing Service', 'W3SVC', 'IIS 관리자를 통해 웹 연결과 관리를 제공합니다.', '자동', ON, LS, true],
  ].map(function (r) { return { display: r[0], name: r[1], desc: r[2], start: r[3], status: r[4], logon: r[5], pausable: !!r[6] }; });

  var GROUPS = [
    ['Access Control Assistance Operators', '이 컴퓨터 리소스의 권한 부여 특성과 사용 권한을 원격으로 조회할 수 있습니다.'],
    ['Administrators', '이 컴퓨터에 대한 모든 액세스 권한이 있는 관리자 그룹입니다.'],
    ['Backup Operators', '파일을 백업하거나 복원할 때 보안 제한을 무시할 수 있습니다.'],
    ['Certificate Service DCOM Access', '이 컴퓨터의 인증 기관에 연결할 수 있습니다.'],
    ['Cryptographic Operators', '암호화 작업을 수행할 수 있습니다.'],
    ['Distributed COM Users', '이 컴퓨터에서 분산 COM 개체를 시작·활성화·사용할 수 있습니다.'],
    ['Event Log Readers', '로컬 컴퓨터의 이벤트 로그를 읽을 수 있습니다.'],
    ['Guests', 'Users 그룹과 같은 기본 액세스를 갖습니다. Guest 계정은 이보다 더 제한됩니다.'],
    ['Hyper-V Administrators', 'Hyper-V의 모든 기능을 제한 없이 사용할 수 있습니다.'],
    ['IIS_IUSRS', '인터넷 정보 서비스(IIS)가 사용하는 기본 제공 그룹입니다.'],
    ['Network Configuration Operators', '네트워크 기능의 구성을 관리할 수 있는 일부 관리 권한이 있습니다.'],
    ['Performance Log Users', '성능 카운터 로깅을 예약하고 추적 공급자를 사용하며 이벤트 추적을 수집할 수 있습니다.'],
    ['Performance Monitor Users', '성능 카운터 데이터에 로컬과 원격으로 접근할 수 있습니다.'],
    ['Power Users', '이전 버전과의 호환성을 위해 포함된 그룹으로, 제한된 관리자 권한이 있습니다.'],
    ['Print Operators', '도메인 프린터를 관리할 수 있습니다.'],
    ['Remote Desktop Users', '원격으로 로그온할 수 있는 권한이 있습니다.'],
    ['Remote Management Users', '관리 프로토콜(WS-Management)로 WMI 리소스에 접근할 수 있습니다.'],
    ['Replicator', '도메인에서 파일 복제를 지원합니다.'],
    ['Storage Replica Administrators', '저장소 복제본의 모든 기능을 사용할 수 있습니다.'],
    ['Users', '시스템 전체를 바꾸지 못하며 대부분의 응용 프로그램을 실행할 수 있습니다.'],
  ].map(function (g) { return { name: g[0], desc: g[1] }; });

  // 보안 옵션: [키, 정책 이름, 종류, 기본값]
  var SECOPTS = [
    ['adminName', '계정: Administrator 계정 이름 바꾸기', 'text', 'Administrator'],
    ['guestName', '계정: Guest 계정 이름 바꾸기', 'text', 'Guest'],
    ['guestOn', '계정: Guest 계정 상태', 'bool', false],
    ['blankConsole', '계정: 로컬 계정의 빈 암호 사용을 콘솔 로그온에만 허용', 'bool', true],
    ['noCAD', '대화형 로그온: [Ctrl+Alt+Del]을 사용할 필요 없음', 'bool', false],
    ['msgTitle', '대화형 로그온: 로그온을 시도하는 사용자에 대한 메시지 제목', 'text', ''],
    ['msgText', '대화형 로그온: 로그온을 시도하는 사용자에 대한 메시지 텍스트', 'textarea', ''],
    ['noLastUser', '대화형 로그온: 마지막 사용자 이름 표시 안 함', 'bool', false],
    ['pwWarn', '대화형 로그온: 암호 만료 전에 암호 변경 여부 묻기', 'days', 5],
    ['shutdownNoLogon', '시스템 종료: 로그온하지 않고 시스템 종료 허용', 'bool', false],
    ['anonSid', '네트워크 액세스: 익명 SID/이름 변환 허용', 'bool', false],
    ['printerDrivers', '장치: 사용자가 프린터 드라이버를 설치할 수 없게 함', 'bool', true],
  ].map(function (r) { return { key: r[0], label: r[1], kind: r[2], def: r[3] }; });

  var SESSION_TIMES = ['안 함', '1분', '5분', '10분', '15분', '30분', '1시간', '2시간', '3시간', '1일', '2일'];

  return { SERVICES: SERVICES, GROUPS: GROUPS, SECOPTS: SECOPTS, SESSION_TIMES: SESSION_TIMES };
}));
