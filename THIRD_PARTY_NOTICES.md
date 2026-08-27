# Third-party notices

## Jtg server-management inspiration

BT Panel’s optional game-server management module is adapted in design and feature shape from the public repository [JishnuTheGamer/Jtg](https://github.com/JishnuTheGamer/Jtg). The upstream package metadata declares the ISC license. BT Panel does not copy the upstream React/Vite application wholesale; it ports the compatible server, Docker, file, backup, console, node, and Modrinth-management concepts into the existing Express/EJS dashboard and keeps BT Panel authentication and storage conventions.

The upstream SFTP implementation and Playit tunnel workflow are not included because they require separate host services and are incomplete or tightly coupled to the upstream runtime. The BT Panel implementation should be reviewed and tested on a dedicated Linux/Docker host before production use.
