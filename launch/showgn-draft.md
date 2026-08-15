# Show GN 초안

글 종류. Show (프로젝트 소개)

제목. Show GN: Claude Code 설정을 통째로 DeepSeek Harness로 옮겨주는 CLI를 만들었습니다

URL. https://github.com/sjh9714/dsh-movein

내용.

DeepSeek Harness가 공개되고 사흘 동안 지켜보다가 한번 갈아타서 써보고 싶은데, 그동안 쌓아둔 CLAUDE.md 규칙이랑 스킬, MCP 서버, hooks 설정을 다시 만들 생각을 하니 손이 안 갔습니다. 그래서 자산별로 어디로 가야 하는지 하나씩 조사해봤는데, 의외로 DSH가 CLAUDE.md를 기본으로 읽고 SKILL.md 포맷도 그대로 호환이라 절반은 이미 공짜였습니다. 나머지(.mcp.json, hooks, 서브에이전트, 권한 규칙)만 기계적으로 변환하면 되길래 하루 만에 CLI로 만들었습니다.

npx dsh-movein 한 번이면 이삿짐 견적서(dry run)가 나오고, --apply를 붙이면 실제로 옮깁니다.

- 프로젝트 CLAUDE.md는 옮길 필요 자체가 없음 (DSH가 원래 읽음)
- 스킬은 심링크라 원본 수정이 양쪽에 반영됨
- .mcp.json은 DSH 설정 행으로 변환되는데 툴 이름(mcp__server__tool)이 양쪽이 완전히 같아서 무손실
- hooks는 DSH가 1st party로 만들어둔 Claude Code 브리지에 연결만 해주면 기존 설정이 그대로 돎
- 권한 규칙의 deny와 ask는 동봉 플러그인이 강제하고, 매핑 안 되는 규칙은 침묵하지 않고 차이 리포트로 보여줌

만들면서 세 번 데였습니다. 프로필이 못 찾는 패키지를 설정에 쓰면 DSH가 경고가 아니라 부팅 실패를 하고, 주변 패키지 npm latest 태그가 코어보다 뒤처져 있고, hooks 브리지의 peer 의존성 하나는 호스트에 동봉이 안 되어 있어서 같이 설치해야 합니다. 이런 함정을 도구가 대신 밟아주는 게 존재 이유가 됐습니다.

세션(대화 이력)은 범위 밖인데, 이건 dsh-chat-import라는 잘 만든 도구가 이미 있어서 상호 보완으로 씁니다.

npm: https://www.npmjs.com/package/dsh-movein
