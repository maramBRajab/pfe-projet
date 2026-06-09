package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.AdminRolesDto.RoleItem;

public interface AdminRolesService {

    List<RoleItem> getRoles();
}
